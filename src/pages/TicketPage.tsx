import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { ArrowLeft, Download, Printer, Ticket as TicketIcon } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Tilt3D } from '../components/Tilt3D'
import { supabase } from '../lib/supabase'

type DigitalTicket = {
  id: string
  ticket_code: string
  qr_value: string
  status: string
  checked_in: boolean
  checked_in_at: string | null
  ticket_types: { name: string } | null
  orders: { events: { name: string; event_date: string | null; event_time: string | null; venue: string } | null } | null
}

export function TicketPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ticket, setTicket] = useState<DigitalTicket>()
  const [qrImage, setQrImage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function loadTicket() {
      if (!supabase) {
        setError('Connect the Supabase project to view digital tickets.')
        setLoading(false)
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/login', { state: { from: `/ticket/${id}` }, replace: true })
        return
      }
      const { data, error: queryError } = await supabase.from('tickets')
        .select('id,ticket_code,qr_value,status,checked_in,checked_in_at,ticket_types(name),orders(events(name,event_date,event_time,venue))')
        .eq('id', id).maybeSingle()
      if (!alive) return
      if (queryError || !data) {
        setError(queryError?.message ?? 'Ticket not found or unavailable.')
        setLoading(false)
        return
      }
      const ticketData = data as unknown as DigitalTicket
      setTicket(ticketData)
      try {
        const qrUrl = `${window.location.origin}/verify/${ticketData.qr_value}`
        const image = await QRCode.toDataURL(qrUrl, { width: 280, margin: 1, errorCorrectionLevel: 'H' })
        if (alive) setQrImage(image)
      } catch {
        if (alive) setError('Unable to generate the ticket QR code.')
      }
      if (alive) setLoading(false)
    }
    void loadTicket()
    return () => { alive = false }
  }, [id, navigate])

  if (loading) return <main className="to-page"><p className="to-state">Loading ticket…</p></main>
  if (error || !ticket) return (
    <main className="to-page">
      <div className="to-wrap">
        <p className="to-form-error" role="alert">{error || 'Ticket unavailable.'}</p>
        <Link className="to-back" to="/dashboard"><ArrowLeft size={16} /> Back to dashboard</Link>
      </div>
    </main>
  )

  const event = ticket.orders?.events
  const stateClass = ticket.checked_in ? 'is-used' : ticket.status === 'valid' ? 'is-valid' : 'is-invalid'
  return (
    <main className="to-page">
      <div className="to-ticket-stage">
        <Link className="to-back to-no-print" to="/dashboard"><ArrowLeft size={16} /> Back to dashboard</Link>
        <Tilt3D className="to-ticket-wrap" max={6} scale={1.02}>
          <article className="to-ticket">
            <div className="to-ticket-main">
              <p className="to-kicker is-gold">{event?.name ?? 'THE TAKE OVER'}</p>
              <h1 className="to-gold-text">{ticket.ticket_types?.name ?? 'Event ticket'}</h1>
              <div className="to-ticket-label">Ticket code</div>
              <strong className="to-ticket-code">{ticket.ticket_code}</strong>
              <dl className="to-ticket-facts">
                <div><dt>Date</dt><dd>{event?.event_date ? new Date(`${event.event_date}T12:00:00`).toLocaleDateString() : 'November 20'}</dd></div>
                <div><dt>Time</dt><dd>{event?.event_time || '9 PM'}</dd></div>
                <div><dt>Venue</dt><dd>{event?.venue || 'Club Luna, opposite EKSU Field'}</dd></div>
              </dl>
              <span className={`to-ticket-state ${stateClass}`}>
                {ticket.checked_in ? 'Ticket used' : ticket.status === 'valid' ? 'Valid ticket' : 'Ticket cancelled'}
              </span>
              {ticket.checked_in_at && <p className="to-checkin-time">Checked in {new Date(ticket.checked_in_at).toLocaleString()}</p>}
            </div>
            <div className="to-ticket-qr">
              {qrImage
                ? <img src={qrImage} alt={`Secure QR code for ticket ${ticket.ticket_code}`} />
                : <div className="to-qr-missing"><TicketIcon size={28} /><strong>QR unavailable</strong><small>Not valid for entry</small></div>}
              <small>{qrImage ? 'Secure entry QR · one scan per pass' : 'A QR code is required at entry'}</small>
            </div>
          </article>
        </Tilt3D>
        <div className="to-ticket-tools to-no-print">
          {qrImage && <a className="to-btn" href={qrImage} download={`${ticket.ticket_code}.png`}><Download size={16} /> Download QR</a>}
          <button className="to-btn to-btn-ghost" onClick={() => window.print()}><Printer size={16} /> Print ticket</button>
        </div>
      </div>
    </main>
  )
}
