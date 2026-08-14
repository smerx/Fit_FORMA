export const config = {
  api: { bodyParser: false, sizeLimit: '25mb' },
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
      res.end('POST only')
      return
    }
    const key = header(req, 'x-groq-key')
    if (!key) {
      res.statusCode = 401
      res.end('Нет ключа Groq')
      return
    }
    const body = await readBuffer(req)
    const groq = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': header(req, 'content-type') || 'application/octet-stream',
      },
      body,
    })
    const text = await groq.text()
    res.statusCode = groq.status
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end(text)
  } catch (e) {
    res.statusCode = 500
    res.end(e instanceof Error ? e.message : 'proxy error')
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
  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}
