import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import QRCode from 'npm:qrcode@1.5.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character)
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const authorization = request.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const emailFrom = Deno.env.get('EMAIL_FROM')
  const siteUrl = Deno.env.get('SITE_URL')
  if (!authorization || !supabaseUrl || !supabaseAnonKey || !resendApiKey || !emailFrom || !siteUrl) {
    return jsonResponse({ error: 'Function configuration is incomplete' }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return jsonResponse({ error: 'Authentication required' }, 401)

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profileError || profile?.role !== 'admin') return jsonResponse({ error: 'Admin access required' }, 403)

  let orderId: string
  try {
    const body = await request.json()
    orderId = body.orderId
    if (typeof orderId !== 'string') throw new Error('Missing order id')
  } catch {
    return jsonResponse({ error: 'A valid orderId is required' }, 400)
  }

  const { data: order, error: orderError } = await supabase.from('orders')
    .select('id,payment_status,profiles(full_name,email),events(name,event_date,event_time,venue),ticket_types(name),tickets(id,ticket_code,qr_value)')
    .eq('id', orderId).maybeSingle()
  if (orderError || !order) return jsonResponse({ error: 'Order not found' }, 404)
  if (order.payment_status !== 'approved') return jsonResponse({ error: 'Payment has not been approved' }, 409)
  if (!order.profiles?.email || !order.tickets?.length) return jsonResponse({ error: 'Customer or generated tickets are missing' }, 409)

  const customerName = escapeHtml(order.profiles.full_name || 'Ticket holder')
  const eventName = escapeHtml(order.events?.name || 'THE TAKE OVER')
  const ticketType = escapeHtml(order.ticket_types?.name || 'Event ticket')
  const eventDate = escapeHtml(order.events?.event_date || 'November 20')
  const eventTime = escapeHtml(order.events?.event_time || '9 PM')
  const venue = escapeHtml(order.events?.venue || 'Club Luna, opposite EKSU Field')
  const results: { ticketCode: string; ok: boolean }[] = []

  for (const ticket of order.tickets) {
    const qrUrl = new URL(`/verify/${ticket.qr_value}`, siteUrl).toString()
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 360, margin: 1, errorCorrectionLevel: 'H' })
    const qrContent = qrDataUrl.split(',')[1]
    const contentId = `ticket-qr-${ticket.id}`
    const ticketCode = escapeHtml(ticket.ticket_code)
    const html = `
      <div style="margin:0;background:#eef7f8;padding:32px 16px;font-family:Arial,sans-serif;color:#102a36">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #d5e3e5">
          <div style="padding:26px 30px;background:#071d29;color:#ffffff">
            <p style="margin:0 0 10px;color:#70d8e3;font-size:11px;font-weight:bold;letter-spacing:2px">THE TAKE OVER</p>
            <h1 style="margin:0;font-size:25px">Your ticket has been confirmed</h1>
          </div>
          <div style="padding:26px 30px">
            <p style="margin:0 0 20px">Hello ${customerName}, your payment is approved. Keep this ticket ready for entry.</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:9px 0;color:#667b81">Event</td><td style="padding:9px 0;font-weight:bold">${eventName}</td></tr>
              <tr><td style="padding:9px 0;color:#667b81">Ticket type</td><td style="padding:9px 0;font-weight:bold">${ticketType}</td></tr>
              <tr><td style="padding:9px 0;color:#667b81">Ticket code</td><td style="padding:9px 0;font-family:monospace;font-weight:bold">${ticketCode}</td></tr>
              <tr><td style="padding:9px 0;color:#667b81">Date</td><td style="padding:9px 0;font-weight:bold">${eventDate}</td></tr>
              <tr><td style="padding:9px 0;color:#667b81">Time</td><td style="padding:9px 0;font-weight:bold">${eventTime}</td></tr>
              <tr><td style="padding:9px 0;color:#667b81">Venue</td><td style="padding:9px 0;font-weight:bold">${venue}</td></tr>
            </table>
            <div style="margin:24px 0;text-align:center"><img src="cid:${contentId}" width="210" height="210" alt="Ticket QR code" /></div>
            <p style="margin:0;color:#667b81;font-size:12px;text-align:center">Show this QR code to event staff at the entrance. Each ticket can be checked in once.</p>
          </div>
        </div>
      </div>`

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: emailFrom,
        to: [order.profiles.email],
        subject: `Your ticket is confirmed: ${order.events?.name || 'THE TAKE OVER'}`,
        html,
        attachments: [{ filename: `${ticket.ticket_code}.png`, content: qrContent, content_id: contentId }],
      }),
    })
    results.push({ ticketCode: ticket.ticket_code, ok: resendResponse.ok })
    if (!resendResponse.ok) {
      const details = await resendResponse.text()
      return jsonResponse({ error: 'Resend could not deliver every ticket email', details, results }, 502)
    }
  }

  return jsonResponse({ sent: results.length, results })
})