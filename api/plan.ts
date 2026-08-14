import type { IncomingMessage, ServerResponse } from 'node:http'
import { groqKeyFrom, proxyPlan, readBody, sendJson } from '../server/groq-proxy'

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'POST only' })
      return
    }
    const key = groqKeyFrom(req)
    let payload: { transcript?: string; today?: string } = {}
    try {
      payload = JSON.parse((await readBody(req)).toString('utf8')) as { transcript?: string; today?: string }
    } catch {
      sendJson(res, 400, { error: 'Плохой JSON' })
      return
    }
    if (!key) {
      sendJson(res, 401, { error: 'Нет ключа Groq' })
      return
    }
    const out = await proxyPlan(key, payload.transcript || '', payload.today || '')
    sendJson(res, out.status, out.json)
  } catch (e) {
    sendJson(res, 500, { error: e instanceof Error ? e.message : 'proxy error' })
  }
}
