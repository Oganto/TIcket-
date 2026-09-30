import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowUpRight, Save, Shield } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { event } from '../data/event'
import { supabase } from '../lib/supabase'

type EventRecord = { id: string; name: string; description: string; event_date: string | null; event_time: string | null; venue: string; status: 'draft' | 'published' | 'archived'; image_path: string | null }
type TicketRecord = { id: string; name: string; description: string; price: number; quantity_available: number; quantity_sold: number; status: 'active' | 'paused' | 'sold_out' }

export function AdminManagePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const isEventPage = location.pathname === '/admin/event'
  const [eventRecord, setEventRecord] = useState<EventRecord>()
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [name, setName] = useState<string>(event.name)
  const [description, setDescription] = useState<string>(event.tagline)
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState<string>(event.doors)
  const [venue, setVenue] = useState(`${event.venue}, ${event.venueDetail}`)
  const [eventStatus, setEventStatus] = useState<'draft' | 'published' | 'archived'>('draft')
  const [bank, setBank] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [newTicketName, setNewTicketName] = useState('')
  const [newTicketDescription, setNewTicketDescription] = useState('')
  const [newTicketPrice, setNewTicketPrice] = useState('')
  const [newTicketQuantity, setNewTicketQuantity] = useState('')
  const [flyerFile, setFlyerFile] = useState<File>()
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let alive = true
    async function loadSettings() {
      if (!supabase) {
        setError('Configure Supabase to manage event settings.')
        setLoading(false)
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/login', { state: { from: location.pathname }, replace: true })
        return
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
      if (!alive) return
      if (profile?.role !== 'admin') {
        setError('Admin access is required for this page.')
        setLoading(false)
        return
      }
      const { data: currentEvent, error: eventError } = await supabase.from('events')
        .select('id,name,description,event_date,event_time,venue,status,image_path')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!alive) return
      if (eventError) setError(eventError.message)
      if (currentEvent) {
        const row = currentEvent as EventRecord
        setEventRecord(row)
        setName(row.name)
        setDescription(row.description)
        setEventDate(row.event_date ?? '')
        setEventTime(row.event_time ?? '')
        setVenue(row.venue)
        setEventStatus(row.status)
        setImagePath(row.image_path)
        const { data: payment } = await supabase.from('payment_settings')
          .select('bank,account_name,account_number').eq('event_id', row.id).maybeSingle()
        if (!alive) return
        if (payment) {
          setBank(payment.bank)
          setAccountName(payment.account_name)
          setAccountNumber(payment.account_number)
        }
        const { data: ticketRows, error: ticketError } = await supabase.from('ticket_types')
          .select('id,name,description,price,quantity_available,quantity_sold,status')
          .eq('event_id', row.id).order('price')
        if (!alive) return
        if (ticketError) setError(ticketError.message)
        else setTickets((ticketRows ?? []) as TicketRecord[])
      }
      if (alive) setLoading(false)
    }
    void loadSettings()
    return () => { alive = false }
  }, [location.pathname, navigate, refresh])

  async function saveEvent(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (!supabase) return
    setSaving(true)
    setError('')
    setMessage('')
    const values = { name, description, event_date: eventDate || null, event_time: eventTime, venue, status: eventStatus }
    const response = eventRecord
      ? await supabase.from('events').update(values).eq('id', eventRecord.id).select('id,name,description,event_date,event_time,venue,status,image_path').single()
      : await supabase.from('events').insert({ ...values, status: 'draft' }).select('id,name,description,event_date,event_time,venue,status,image_path').single()
    if (response.error) setError(response.error.message)
    else {
      if (flyerFile) {
        const safeName = flyerFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const uploadedPath = `${response.data.id}/${crypto.randomUUID()}-${safeName}`
        const { error: uploadError } = await supabase.storage.from('event-assets').upload(uploadedPath, flyerFile, { contentType: flyerFile.type })
        if (uploadError) {
          setError(uploadError.message)
          setSaving(false)
          return
        }
        const { error: imageError } = await supabase.from('events').update({ image_path: uploadedPath }).eq('id', response.data.id)
        if (imageError) {
          setError(imageError.message)
          setSaving(false)
          return
        }
        setFlyerFile(undefined)
        setImagePath(uploadedPath)
      }
      setMessage(eventRecord ? 'Event details saved.' : 'Draft event created. Add ticket types and payment details before publishing.')
      setRefresh((value) => value + 1)
    }
    setSaving(false)
  }

  async function savePaymentSettings(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (!supabase || !eventRecord) return
    setSaving(true)
    setError('')
    setMessage('')
    const { error: saveError } = await supabase.from('payment_settings').upsert({
      event_id: eventRecord.id, bank, account_name: accountName, account_number: accountNumber,
    })
    if (saveError) setError(saveError.message)
    else setMessage('Payment account details saved.')
    setSaving(false)
  }

  async function addTicketType(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (!supabase || !eventRecord) return
    setSaving(true)
    setError('')
    setMessage('')
    const { error: saveError } = await supabase.from('ticket_types').insert({
      event_id: eventRecord.id,
      name: newTicketName,
      description: newTicketDescription,
      price: Number(newTicketPrice),
      quantity_available: Number(newTicketQuantity),
      status: 'active',
    })
    if (saveError) setError(saveError.message)
    else {
      setNewTicketName('')
      setNewTicketDescription('')
      setNewTicketPrice('')
      setNewTicketQuantity('')
      setMessage('Ticket type added.')
      setRefresh((value) => value + 1)
    }
    setSaving(false)
  }

  async function updateTicket(ticket: TicketRecord) {
    if (!supabase) return
    setSaving(true)
    setError('')
    setMessage('')
    const { error: saveError } = await supabase.from('ticket_types').update({
      price: Number(ticket.price), quantity_available: Number(ticket.quantity_available), status: ticket.status,
    }).eq('id', ticket.id)
    if (saveError) setError(saveError.message)
    else setMessage(`${ticket.name} updated.`)
    setSaving(false)
  }

  function editTicket(id: string, key: 'price' | 'quantity_available' | 'status', value: string) {
    setTickets((current) => current.map((ticket) => ticket.id === id ? {
      ...ticket,
      [key]: key === 'status' ? value : Number(value),
    } as TicketRecord : ticket))
  }

  return (
    <main className="admin-page">
      <div className="admin-heading"><div><p className="eyebrow"><span className="eyebrow-rule" /> CONTROL ROOM</p><h1>{isEventPage ? 'Event details' : 'Payment & tickets'}</h1></div><span className="admin-shield"><Shield size={17} /> Admin only</span></div>
      <nav className="admin-tabs" aria-label="Admin navigation"><Link className="admin-tab" to="/admin">Overview</Link><Link className="admin-tab" to="/admin/orders">Orders</Link><Link className="admin-tab" to="/admin/tickets">Tickets</Link><Link className={isEventPage ? 'admin-tab active' : 'admin-tab'} to="/admin/event">Event</Link><Link className={!isEventPage ? 'admin-tab active' : 'admin-tab'} to="/admin/settings">Settings</Link></nav>
      {loading && <p className="state-message">Loading settings…</p>}
      {!loading && error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      {!loading && !error && isEventPage && <form className="admin-form-panel" onSubmit={saveEvent}>
        <label>Event name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Description<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <div className="admin-form-row"><label>Event date<input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} /><small>Leave blank while the year is unconfirmed.</small></label><label>Time<input value={eventTime} onChange={(event) => setEventTime(event.target.value)} /></label></div>
        <label>Venue<input required value={venue} onChange={(event) => setVenue(event.target.value)} /></label>
        <label>Official flyer<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFlyerFile(event.target.files?.[0])} /><small>{flyerFile?.name ?? (imagePath ? 'Current flyer uploaded' : 'JPG, PNG, or WebP · Max 10 MB')}</small></label>
        {eventRecord && <label>Status<select value={eventStatus} onChange={(event) => setEventStatus(event.target.value as typeof eventStatus)}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>}
        <button className="button button-dark" disabled={saving} type="submit"><Save size={16} /> {saving ? 'Saving…' : eventRecord ? 'Save event' : 'Create draft event'}</button>
      </form>}
      {!loading && !error && !isEventPage && eventRecord && <div className="admin-manage-grid">
        <form className="admin-form-panel" onSubmit={savePaymentSettings}>
          <p className="eyebrow"><span className="eyebrow-rule" /> PAYMENT ACCOUNT</p><h2>Transfer details</h2>
          <label>Bank<input required value={bank} onChange={(event) => setBank(event.target.value)} /></label>
          <label>Account name<input required value={accountName} onChange={(event) => setAccountName(event.target.value)} /></label>
          <label>Account number<input required inputMode="numeric" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} /></label>
          <button className="button button-dark" disabled={saving} type="submit"><Save size={16} /> Save payment details</button>
        </form>
        <section className="admin-form-panel">
          <p className="eyebrow"><span className="eyebrow-rule" /> TICKET INVENTORY</p><h2>Ticket types</h2>
          <form className="new-ticket-form" onSubmit={addTicketType}>
            <label>Name<input required value={newTicketName} onChange={(event) => setNewTicketName(event.target.value)} /></label>
            <label>Details<input value={newTicketDescription} onChange={(event) => setNewTicketDescription(event.target.value)} /></label>
            <div className="admin-form-row"><label>Price<input required type="number" min="0" step="0.01" value={newTicketPrice} onChange={(event) => setNewTicketPrice(event.target.value)} /></label><label>Quantity<input required type="number" min="1" step="1" value={newTicketQuantity} onChange={(event) => setNewTicketQuantity(event.target.value)} /></label></div>
            <button className="button button-dark" disabled={saving} type="submit">Add ticket type <ArrowUpRight size={16} /></button>
          </form>
          <div className="inventory-list">{tickets.map((ticket) => <div className="inventory-row" key={ticket.id}>
            <strong>{ticket.name}<small>{ticket.quantity_sold} sold</small></strong>
            <label>Price<input aria-label={`${ticket.name} price`} type="number" min="0" step="0.01" value={ticket.price} onChange={(event) => editTicket(ticket.id, 'price', event.target.value)} /></label>
            <label>Qty<input aria-label={`${ticket.name} quantity`} type="number" min={ticket.quantity_sold} value={ticket.quantity_available} onChange={(event) => editTicket(ticket.id, 'quantity_available', event.target.value)} /></label>
            <label>Status<select aria-label={`${ticket.name} status`} value={ticket.status} onChange={(event) => editTicket(ticket.id, 'status', event.target.value)}><option value="active">Active</option><option value="paused">Paused</option><option value="sold_out">Sold out</option></select></label>
            <button className="inventory-save" onClick={() => void updateTicket(ticket)} disabled={saving} title={`Save ${ticket.name}`}><Save size={15} /></button>
          </div>)}</div>
        </section>
      </div>}
      {!loading && !error && !isEventPage && !eventRecord && <p className="empty-admin">Create the event first before configuring payment details or ticket inventory.</p>}
    </main>
  )
}