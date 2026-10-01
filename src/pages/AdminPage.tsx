import { useEffect, useState } from 'react'
import { ArrowUpRight, Check, ClipboardList, Search, Shield, Ticket, X } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type AdminOrder = {
  id: string
  quantity: number
  total_amount: number
  payment_status: 'pending' | 'approved' | 'rejected'
  payment_proof_path: string
  created_at: string
  profiles: { full_name: string; email: string; phone: string | null } | null
  events: { name: string } | null
  ticket_types: { name: string } | null
  tickets: { id: string; ticket_code: string; checked_in: boolean }[]
}

type AdminTicket = {
  id: string
  ticket_code: string
  status: string
  checked_in: boolean
  created_at: string
  profiles: { full_name: string; email: string } | null
  ticket_types: { name: string } | null
}

const tabs = [
  { path: '/admin', label: 'Overview', icon: Shield },
  { path: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { path: '/admin/tickets', label: 'Tickets', icon: Ticket },
  { path: '/admin/event', label: 'Event', icon: Shield },
  { path: '/admin/settings', label: 'Settings', icon: Shield },
]

function describeDbError(error: { message: string; details?: string | null; hint?: string | null; code?: string }) {
  return [error.message, error.details, error.hint, error.code ? `(code ${error.code})` : ''].filter(Boolean).join(' · ')
}

async function describeFunctionError(error: unknown) {
  const fallback = error instanceof Error ? error.message : 'Unknown error'
  const context = (error as { context?: unknown } | null)?.context
  if (context instanceof Response) {
    try {
      const body = await context.clone().json() as { error?: string; details?: string }
      if (body.error) return body.details ? `${body.error} (${body.details})` : body.error
    } catch {
      // The response body was not JSON; fall back to the generic message.
    }
  }
  return fallback
}

export function AdminPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [tickets, setTickets] = useState<AdminTicket[]>([])
  const [search, setSearch] = useState('')
  const [proofLinks, setProofLinks] = useState<Record<string, string>>({})
  const [refresh, setRefresh] = useState(0)
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [workingId, setWorkingId] = useState('')
  const [error, setError] = useState('')
  const tab = location.pathname === '/admin/orders' ? 'orders' : location.pathname === '/admin/tickets' ? 'tickets' : 'overview'

  useEffect(() => {
    let alive = true
    async function loadAdminData() {
      if (!supabase) {
        setError('Configure Supabase to use the admin area.')
        setLoading(false)
        return
      }
      const client = supabase
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/login', { state: { from: location.pathname }, replace: true })
        return
      }
      const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
      if (!alive) return
      if (profileError || profile?.role !== 'admin') {
        setError('Admin access is required for this page.')
        setLoading(false)
        return
      }
      setAuthorized(true)
      if (tab === 'orders' || tab === 'overview') {
        const { data, error: queryError } = await supabase.from('orders')
          .select('id,quantity,total_amount,payment_status,payment_proof_path,created_at,profiles(full_name,email,phone),events(name),ticket_types(name),tickets(id,ticket_code,checked_in)')
          .order('created_at', { ascending: false })
        if (!alive) return
        if (queryError) setError(queryError.message)
        else {
          const items = (data ?? []) as unknown as AdminOrder[]
          setOrders(items)
          if (tab === 'orders') {
            const pending = items.filter((order) => order.payment_status === 'pending')
            const links = await Promise.all(pending.map(async (order) => {
              const { data: signed } = await client.storage.from('payment-proofs').createSignedUrl(order.payment_proof_path, 300)
              return signed?.signedUrl ? [order.id, signed.signedUrl] as const : null
            }))
            if (alive) setProofLinks(Object.fromEntries(links.filter((entry): entry is readonly [string, string] => entry !== null)))
          }
        }
      }
      if (tab === 'tickets') {
        const { data, error: queryError } = await supabase.from('tickets')
          .select('id,ticket_code,status,checked_in,created_at,profiles(full_name,email),ticket_types(name)')
          .order('created_at', { ascending: false })
        if (!alive) return
        if (queryError) setError(queryError.message)
        else setTickets((data ?? []) as unknown as AdminTicket[])
      }
      if (alive) setLoading(false)
    }
    void loadAdminData()
    return () => { alive = false }
  }, [location.pathname, navigate, refresh, tab])

  async function reviewOrder(order: AdminOrder, approve: boolean) {
    if (!supabase || workingId) return
    if (!approve && !window.confirm('Reject this payment proof?')) return
    setNotice(null)
    setWorkingId(order.id)
    try {
      const rpcName = approve ? 'approve_order' : 'reject_order'
      const args = approve ? { p_order_id: order.id } : { p_order_id: order.id, p_reason: 'Payment proof rejected by admin' }
      const { error: reviewError } = await supabase.rpc(rpcName, args)
      if (reviewError) {
        setNotice({ kind: 'error', text: `${approve ? 'Approval' : 'Rejection'} failed: ${describeDbError(reviewError)}` })
        return
      }
      if (approve) {
        const { error: emailError } = await supabase.functions.invoke('send-ticket-email', { body: { orderId: order.id } })
        if (emailError) setNotice({ kind: 'error', text: `Payment approved, but the ticket email was not sent: ${await describeFunctionError(emailError)}` })
        else setNotice({ kind: 'success', text: 'Payment approved and ticket email sent.' })
      } else {
        setNotice({ kind: 'success', text: 'Payment marked as rejected.' })
      }
      setRefresh((value) => value + 1)
    } catch (unexpected) {
      setNotice({ kind: 'error', text: unexpected instanceof Error ? unexpected.message : 'Something went wrong. Please try again.' })
    } finally {
      setWorkingId('')
    }
  }

  const filteredOrders = orders.filter((order) => `${order.id} ${order.profiles?.full_name ?? ''} ${order.profiles?.email ?? ''} ${order.payment_status}`.toLowerCase().includes(search.toLowerCase()))
  const filteredTickets = tickets.filter((ticket) => `${ticket.ticket_code} ${ticket.profiles?.full_name ?? ''} ${ticket.profiles?.email ?? ''}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <main className="admin-page">
      <div className="admin-heading"><div><p className="eyebrow"><span className="eyebrow-rule" /> CONTROL ROOM</p><h1>Event admin</h1></div><span className="admin-shield"><Shield size={17} /> Admin only</span></div>
      <nav className="admin-tabs" aria-label="Admin navigation">
        {tabs.map(({ path, label, icon: Icon }) => <Link key={path} className={location.pathname === path ? 'admin-tab active' : 'admin-tab'} to={path}><Icon size={16} />{label}</Link>)}
      </nav>
      {!loading && error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p className="state-message">Loading admin data…</p>}
      {authorized && !loading && tab === 'overview' && <section className="admin-stats">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => <div className="admin-stat" key={status}><span>{status === 'all' ? 'Total orders' : `${status} payments`}</span><b>{status === 'all' ? orders.length : orders.filter((order) => order.payment_status === status).length}</b></div>)}
      </section>}
      {authorized && !loading && (tab === 'orders' || tab === 'tickets') && <>
        <label className="admin-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === 'orders' ? 'Search order, customer, or email' : 'Search ticket, customer, or email'} /></label>
        {tab === 'orders' && <section className="admin-list">{filteredOrders.map((order) => <article className="admin-order" key={order.id}>
          <div className="admin-order-heading"><div><span className={`status-pill status-${order.payment_status}`}>{order.payment_status}</span><h2>{order.profiles?.full_name || 'Customer'}</h2><small>{order.profiles?.email} {order.profiles?.phone ? `· ${order.profiles.phone}` : ''}</small></div><strong>{Number(order.total_amount).toLocaleString()}</strong></div>
          <div className="admin-order-detail"><span>{order.ticket_types?.name} × {order.quantity}</span><span>{order.events?.name}</span><span>{new Date(order.created_at).toLocaleString()}</span></div>
          {order.payment_status === 'pending' && <div className="admin-order-actions">{proofLinks[order.id] && <a className="proof-link" href={proofLinks[order.id]} target="_blank" rel="noreferrer">Open payment proof <ArrowUpRight size={15} /></a>}<div><button className="reject-button" disabled={workingId !== ''} onClick={() => void reviewOrder(order, false)}><X size={15} /> Reject</button><button className="approve-button" disabled={workingId !== ''} onClick={() => void reviewOrder(order, true)}><Check size={15} /> {workingId === order.id ? 'Approving…' : 'Approve'}</button></div></div>}
          {order.payment_status === 'approved' && <div className="admin-order-detail">{order.tickets?.map((ticket) => <span key={ticket.id}>{ticket.ticket_code}{ticket.checked_in ? ' · Used' : ''}</span>)}</div>}
        </article>)}{filteredOrders.length === 0 && <p className="empty-admin">No matching orders.</p>}</section>}
        {tab === 'tickets' && <section className="admin-list">{filteredTickets.map((ticket) => <article className="admin-ticket-row" key={ticket.id}><div><strong>{ticket.ticket_code}</strong><span>{ticket.profiles?.full_name} · {ticket.profiles?.email}</span></div><span>{ticket.ticket_types?.name}</span><span className={ticket.checked_in ? 'ticket-used' : 'ticket-valid'}>{ticket.checked_in ? 'Used' : ticket.status}</span></article>)}{filteredTickets.length === 0 && <p className="empty-admin">No matching tickets.</p>}</section>}
      </>}
      {notice && <div role={notice.kind === 'error' ? 'alert' : 'status'} style={{ position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 1000, maxWidth: 560, margin: '0 auto', padding: '14px 16px', borderRadius: 12, display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', background: notice.kind === 'error' ? '#3a0f14' : '#0f3a26', color: '#fff', border: `1px solid ${notice.kind === 'error' ? '#ff6b6b' : '#3ddc97'}`, boxShadow: '0 10px 40px rgba(0,0,0,.5)', fontSize: 14, lineHeight: 1.4 }}><span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Dismiss message" style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button></div>}
    </main>
  )
}
