import type { IncomingMessage, ServerResponse } from 'node:http'

export const PLAN_MODEL = 'openai/gpt-oss-120b'

export function groqKeyFrom(req: IncomingMessage): string {
  const h = req.headers['x-groq-key']
  return (Array.isArray(h) ? h[0] : h) ?? ''
}

export async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

export async function proxyStt(key: string, contentType: string, body: Buffer): Promise<{ status: number; text: string }> {
  const groq = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': contentType,
    },
    body,
  })
  return { status: groq.status, text: await groq.text() }
}

export async function proxyPlan(
  key: string,
  transcript: string,
  today: string,
): Promise<{ status: number; json: unknown }> {
  const groq = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: PLAN_MODEL,
      temperature: 0.15,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Ты разбираешь устную русскую речь в чеклист. Верни JSON вида {"title": string, "tasks": [{"title": string, "notes": string, "dueOn": "YYYY-MM-DD"|null}]}. ' +
            'Только дела, которые человек реально назвал. Не выдумывай. Не превращай болтовню в задачи. ' +
            'title — короткий пункт. notes — уточнение или пустая строка. dueOn только если назван день. Сегодня: ' +
            today,
        },
        { role: 'user', content: transcript },
      ],
    }),
  })
  const data = (await groq.json()) as {
    error?: { message?: string }
    choices?: { message?: { content?: string } }[]
  }
  if (!groq.ok) return { status: groq.status, json: { error: data.error?.message || 'Groq error' } }
  return { status: 200, json: parsePlanContent(data.choices?.[0]?.message?.content || '') }
}

export function sendText(res: ServerResponse, status: number, text: string) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end(text)
}

function parsePlanContent(content: string): unknown {
  const trimmed = content.trim()
  if (!trimmed) return { title: 'План', tasks: [] }
  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        /* fall through */
      }
    }
    return { title: 'План', tasks: [] }
  }
}

export function sendJson(res: ServerResponse, status: number, json: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(json))
}
