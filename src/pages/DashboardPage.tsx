import { useEffect, useState } from 'react'
import { ArrowRight, LogOut, Ticket } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatNaira } from '../hooks/useTicketCatalog'

type Order = {
  id: string
  total_amount: number
  quantity: number
  payment_status: 'pending' | 'approved' | 'rejected'
  created_at: string
  events: { name: string } | null
  ticket_types: { name: string } | null
  tickets: { id: string; ticket_code: string; checked_in: boolean }[]
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function loadOrders() {
      if (!supabase) {
        setError('Connect the Supabase project to view your orders.')
        setLoading(false)
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/login', { replace: true })
        return
      }
      const { data, error: queryError } = await supabase
        .from('orders')
        .select('id,total_amount,quantity,payment_status,created_at,events(name),ticket_types(name),tickets(id,ticket_code,checked_in)')
        .order('created_at', { ascending: false })
      if (!alive) return
      if (queryError) setError(queryError.message)
      else setOrders((data ?? []) as unknown as Order[])
      setLoading(false)
    }
    void loadOrders()
    return () => { alive = false }
  }, [navigate])

  async function logOut() {
    await supabase?.auth.signOut()
    navigate('/')
  }

  return (
    <main className="to-page">
      <div className="to-wrap">
        <div className="to-row-head">
          <div><p className="to-kicker is-gold">Customer area</p><h1>Your orders</h1></div>
          <button className="to-link-btn" onClick={() => void logOut()}><LogOut size={16} /> Log out</button>
        </div>
        {loading && <p className="to-state">Loading your orders…</p>}
        {error && <p className="to-form-error" role="alert">{error}</p>}
        {!loading && !error && orders.length === 0 && <div className="to-empty"><Ticket size={28} /><h2>No orders yet</h2><p>Your event tickets will show up here after checkout.</p><Link className="to-btn" to="/tickets">Browse tickets <ArrowRight size={16} /></Link></div>}
        <div className="to-orders">
          {orders.map((order) => (
            <article className="to-order" key={order.id}>
              <div><p className="to-kicker">{order.events?.name ?? 'THE TAKE OVER'}</p><h2 className="to-order-name">{order.ticket_types?.name ?? 'Ticket'}</h2><small>{order.quantity} · {new Date(order.created_at).toLocaleDateString()}</small></div>
              <div className="to-order-meta"><b>{formatNaira(Number(order.total_amount))}</b><span className={`to-badge is-${order.payment_status}`}>{order.payment_status}</span></div>
              <div className="to-order-tickets">{order.tickets?.map((ticket) => <Link key={ticket.id} to={`/ticket/${ticket.id}`}>{ticket.ticket_code} · {ticket.checked_in ? 'Used' : 'View ticket'}</Link>)}</div>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
