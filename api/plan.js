const PLAN_MODEL = 'openai/gpt-oss-120b'

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
}

export default async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'POST only' }))
      return
    }
    const key = header(req, 'x-groq-key')
    let payload = {}
    try {
      payload = JSON.parse((await readBuffer(req)).toString('utf8'))
    } catch {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Плохой JSON' }))
      return
    }
    if (!key) {
      res.statusCode = 401
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Нет ключа Groq' }))
      return
    }
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
              (payload.today || ''),
          },
          { role: 'user', content: payload.transcript || '' },
        ],
      }),
    })
    const data = await groq.json()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    if (!groq.ok) {
      res.statusCode = groq.status
      res.end(JSON.stringify({ error: data.error?.message || 'Groq error' }))
      return
    }
    res.statusCode = 200
    res.end(JSON.stringify(parsePlan(data.choices?.[0]?.message?.content || '')))
  } catch (e) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'proxy error' }))
  }
}

function header(req, name) {
  if (typeof req.headers?.get === 'function') return req.headers.get(name) || ''
  const value = req.headers?.[name]
  return Array.isArray(value) ? value[0] : value || ''
}

async function readBuffer(req) {
  if (typeof req.arrayBuffer === 'function') return Buffer.from(await req.arrayBuffer())
  if (Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string') return Buffer.from(req.body)
  if (req.body && typeof req.body === 'object') return Buffer.from(JSON.stringify(req.body))
  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

function parsePlan(content) {
  const trimmed = String(content).trim()
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
