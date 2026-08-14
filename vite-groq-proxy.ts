import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite'
import { groqKeyFrom, proxyPlan, proxyStt, readBody, sendJson, sendText } from './server/groq-proxy.ts'

export function groqProxy(): Plugin {
  return {
    name: 'groq-proxy',
    configureServer(server) {
      mount(server)
    },
    configurePreviewServer(server) {
      mount(server)
    },
  }
}

function mount(server: ViteDevServer | PreviewServer) {
  server.middlewares.use('/api/stt', ((req, res) => {
    void handleStt(req, res)
  }) as Connect.NextHandleFunction)
  server.middlewares.use('/api/plan', ((req, res) => {
    void handlePlan(req, res)
  }) as Connect.NextHandleFunction)
}

async function handleStt(req: IncomingMessage, res: ServerResponse) {
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

async function handlePlan(req: IncomingMessage, res: ServerResponse) {
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
    const raw = await readBody(req)
    let payload: { transcript?: string; today?: string } = {}
    try {
      payload = JSON.parse(raw.toString('utf8')) as { transcript?: string; today?: string }
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
