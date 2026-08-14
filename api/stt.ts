import type { IncomingMessage, ServerResponse } from 'node:http'
import { groqKeyFrom, proxyStt, readBody, sendText } from '../server/groq-proxy'

export const config = {
  api: { bodyParser: false, sizeLimit: '25mb' },
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
      sendText(res, 405, 'POST only')
      return
    }
    const key = groqKeyFrom(req)
    if (!key) {
      sendText(res, 401, 'Нет ключа Groq')
      return
    }
    const body = await readBody(req)
    const out = await proxyStt(key, String(req.headers['content-type'] ?? 'application/octet-stream'), body)
    sendText(res, out.status, out.text)
  } catch (e) {
    sendText(res, 500, e instanceof Error ? e.message : 'proxy error')
  }
}
