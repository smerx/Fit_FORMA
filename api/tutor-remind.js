export default async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }
    const secret = process.env.TUTOR_CRON_SECRET
    const auth = String(req.headers.authorization || '')
    if (!secret || auth !== `Bearer ${secret}`) {
      res.statusCode = 401
      res.end('unauthorized')
      return
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const vapidPublic = process.env.VITE_VAPID_PUBLIC_KEY || process.env.TUTOR_VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.TUTOR_VAPID_PRIVATE_KEY
    if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) {
      res.statusCode = 200
      res.end(JSON.stringify({ ok: true, skipped: 'no keys' }))
      return
    }

    let webpush
    try {
      webpush = (await import('web-push')).default
    } catch {
      res.statusCode = 200
      res.end(JSON.stringify({ ok: true, skipped: 'no web-push' }))
      return
    }
    webpush.setVapidDetails('mailto:forma@local', vapidPublic, vapidPrivate)

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    }
    const now = Date.now()
    const from = new Date(now - 20 * 60 * 1000).toISOString()
    const to = new Date(now + 12 * 60 * 1000).toISOString()
    const dueRes = await fetch(
      `${supabaseUrl}/rest/v1/tutor_reminder_queue?sent_at=is.null&fire_at=gte.${from}&fire_at=lte.${to}&select=*`,
      { headers },
    )
    const due = dueRes.ok ? await dueRes.json() : []
    const subRes = await fetch(`${supabaseUrl}/rest/v1/tutor_push_subs?select=*`, { headers })
    const subs = subRes.ok ? await subRes.json() : []
    const byUser = new Map()
    for (const s of subs) {
      const list = byUser.get(s.user_id) || []
      list.push(s)
      byUser.set(s.user_id, list)
    }

    let sent = 0
    for (const row of due) {
      const targets = byUser.get(row.user_id) || []
      for (const s of targets) {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            },
            JSON.stringify({
              title: row.title,
              body: row.body,
              tag: `tutor-${row.tag}`,
            }),
          )
          sent += 1
        } catch {
          /* подписка могла протухнуть */
        }
      }
      await fetch(`${supabaseUrl}/rest/v1/tutor_reminder_queue?id=eq.${row.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ sent_at: new Date().toISOString() }),
      })
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: true, due: due.length, sent }))
  } catch (e) {
    res.statusCode = 500
    res.end(e instanceof Error ? e.message : 'remind error')
  }
}
