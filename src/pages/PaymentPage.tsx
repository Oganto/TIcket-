import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { ArrowLeft, Check, Copy, FileUp, Minus, Plus, ShieldCheck } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePublicEvent } from '../hooks/usePublicEvent'
import { formatNaira } from '../hooks/useTicketCatalog'

type PaymentSettings = { bank: string; account_name: string; account_number: string }
type TicketDetails = { id: string; name: string; price: number; event_id: string; quantity_available: number; quantity_sold: number }

function CheckoutSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  const labels = ['Choose', 'Pay', 'Review', 'Pass']
  return (
    <ol className="to-checkout-steps" aria-label="Checkout progress">
      {labels.map((label, index) => {
        const step = index + 1
        const state = step < current ? 'is-done' : step === current ? 'is-current' : ''
        return <li className={state} key={label} aria-current={step === current ? 'step' : undefined}><span>{String(step).padStart(2, '0')}</span>{label}</li>
      })}
    </ol>
  )
}

function CopyRow({ label, value, copyValue }: { label: string; value: string; copyValue?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyValue ?? value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard access can be blocked; the value stays visible to copy by hand.
    }
  }

  return (
    <div className="to-copyrow">
      <div><dt>{label}</dt><dd>{value}</dd></div>
      <button type="button" className={copied ? 'to-copybtn is-copied' : 'to-copybtn'} onClick={() => void copy()} aria-label={`Copy ${label}`}>
        {copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

export function PaymentPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const event = usePublicEvent()
  const state = location.state as { ticketId?: string; eventId?: string; ticketName?: string; price?: number } | null
  const [ticket, setTicket] = useState<TicketDetails>()
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>()
  const [userId, setUserId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [file, setFile] = useState<File>()
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let alive = true
    async function loadPaymentInfo() {
      if (!supabase) {
        setError('Payment submission is unavailable until the Supabase project is configured.')
        setLoading(false)
        return
      }
      if (!state?.ticketId || !state.eventId) {
        setError('Choose a ticket from the published event catalog before continuing.')
        setLoading(false)
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/login', { state: { from: location.pathname, checkout: state }, replace: true })
        return
      }
      const [ticketResponse, settingsResponse] = await Promise.all([
        supabase.from('ticket_types').select('id,name,price,event_id,quantity_available,quantity_sold').eq('id', state.ticketId).eq('event_id', state.eventId).maybeSingle(),
        supabase.from('payment_settings').select('bank,account_name,account_number').eq('event_id', state.eventId).maybeSingle(),
      ])
      if (!alive) return
      if (ticketResponse.error || settingsResponse.error) {
        setError(ticketResponse.error?.message ?? settingsResponse.error?.message ?? 'Unable to load checkout details.')
      } else if (!ticketResponse.data || !settingsResponse.data) {
        setError('The event payment details are not configured yet.')
      } else {
        setUserId(session.user.id)
        setTicket(ticketResponse.data as TicketDetails)
        setPaymentSettings(settingsResponse.data as PaymentSettings)
      }
      setLoading(false)
    }
    void loadPaymentInfo()
    return () => { alive = false }
  }, [location.pathname, navigate, state?.eventId, state?.ticketId])

  useEffect(() => {
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setPreview(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreview('')
  }, [file])

  function updateFile(changeEvent: ChangeEvent<HTMLInputElement>) {
    const selected = changeEvent.target.files?.[0]
    setError('')
    if (!selected) {
      setFile(undefined)
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(selected.type)) {
      setError('Choose a JPG, PNG, WebP, or PDF payment proof.')
      setFile(undefined)
      return
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError('Payment proof must be 10 MB or smaller.')
      setFile(undefined)
      return
    }
    setFile(selected)
  }

  async function submitOrder(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault()
    if (!supabase || !ticket || !state?.eventId || !file) return
    setError('')
    if (ticket.quantity_available - ticket.quantity_sold < quantity) {
      setError('There are not enough passes available for this quantity.')
      return
    }
    setBusy(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const proofPath = `${userId}/${crypto.randomUUID()}-${safeName}`
    try {
      const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(proofPath, file, { contentType: file.type, upsert: false })
      if (uploadError) throw uploadError
      const { error: orderError } = await supabase.rpc('submit_order', {
        p_event_id: state.eventId,
        p_ticket_type_id: ticket.id,
        p_quantity: quantity,
        p_payment_proof_path: proofPath,
      })
      if (orderError) throw orderError
      setSubmitted(true)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit your order.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <main className="to-page"><p className="to-state">Loading checkout…</p></main>

  if (submitted) return (
    <main className="to-page">
      <section className="to-success">
        <div className="to-success-icon"><Check size={34} /></div>
        <p className="to-kicker is-gold">Payment · Review</p>
        <h1>Proof <span className="to-gold-text">received.</span></h1>
        <p>Your order is pending admin review. A ticket will only be issued after the payment is approved.</p>
        <ul className="to-status-list">
          <li className="is-done"><span className="to-status-dot"><Check size={14} /></span>Order submitted</li>
          <li className="is-done"><span className="to-status-dot"><Check size={14} /></span>Payment proof uploaded</li>
          <li className="is-pending"><span className="to-status-dot">•</span>Admin is reviewing your payment</li>
          <li className="is-later"><span className="to-status-dot">4</span>Your QR ticket is emailed to you</li>
        </ul>
        <Link className="to-btn" to="/dashboard">View my orders</Link>
      </section>
    </main>
  )

  const available = ticket ? ticket.quantity_available - ticket.quantity_sold : 0
  const total = ticket ? Number(ticket.price) * quantity : 0

  return (
    <main className="to-page">
      <div className="to-wrap">
        <Link className="to-back" to="/tickets"><ArrowLeft size={16} /> Back to passes</Link>
        <CheckoutSteps current={2} />
        <div className="to-pay-grid">
          <aside className="to-panel to-receipt">
            <p className="to-kicker is-gold">Your receipt</p>
            <h1>{event.name}</h1>
            <div className="to-receipt-facts"><span>{event.date} · {event.doors}</span><span>{event.venue}, {event.venueDetail}</span></div>
            {event.imageUrl && <div className="to-receipt-poster"><img src={event.imageUrl} alt={`${event.name} flyer`} /></div>}
            {ticket && <>
              <div className="to-receipt-line"><div><span>Pass</span><strong>{ticket.name}</strong></div><strong>{formatNaira(Number(ticket.price))}</strong></div>
              <div className="to-receipt-line">
                <div><span>Quantity</span></div>
                <div className="to-stepper">
                  <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={17} /></button>
                  <output aria-live="polite">{quantity}</output>
                  <button type="button" aria-label="Increase quantity" onClick={() => setQuantity((value) => Math.min(20, value + 1))}><Plus size={17} /></button>
                </div>
              </div>
              <div className="to-total"><span>Total</span><strong>{formatNaira(total)}</strong></div>
              <p className={available > 0 ? 'to-stock' : 'to-stock is-sold'}>{available > 0 ? `${available} available` : 'Currently sold out'}</p>
            </>}
          </aside>

          <section className="to-panel">
            <p className="to-kicker is-gold">02 — Manual transfer</p>
            <h2>Pay by bank transfer</h2>
            {paymentSettings
              ? <dl className="to-copylist">
                <CopyRow label="Bank" value={paymentSettings.bank} />
                <CopyRow label="Account name" value={paymentSettings.account_name} />
                <CopyRow label="Account number" value={paymentSettings.account_number} />
                {ticket && <CopyRow label="Amount to send" value={formatNaira(total)} copyValue={String(total)} />}
              </dl>
              : <p className="to-state">{error || 'Organizer transfer details are not available yet.'}</p>}
            <p className="to-note to-warning">Send the exact amount, then upload your transfer proof for admin review. Your pass is issued only after payment is approved.</p>
            <form onSubmit={submitOrder}>
              <p className="to-kicker" style={{ marginBottom: 10 }}>Payment proof</p>
              {error && paymentSettings && <p className="to-form-error" role="alert">{error}</p>}
              <label className="to-upload">
                <FileUp size={30} />
                <span>{file ? file.name : 'Tap to choose your receipt'}</span>
                <small>JPG, PNG, WebP, or PDF · Max 10 MB</small>
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={updateFile} />
              </label>
              {preview && <img className="to-upload-preview" src={preview} alt="Preview of your payment proof" />}
              <div className="to-stickybar">
                {ticket && <div className="to-stickybar-total"><span>Total</span><b>{formatNaira(total)}</b></div>}
                <button className="to-btn" disabled={busy || !file || !ticket || !paymentSettings || available < quantity} type="submit">{busy ? 'Submitting…' : 'Submit for review'} <ShieldCheck size={17} /></button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  )
}
