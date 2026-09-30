import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PassGroups } from '../components/PassGroups'
import { useTicketCatalog } from '../hooks/useTicketCatalog'

export function TicketsPage() {
  const { tickets, loading, error } = useTicketCatalog()

  return (
    <main className="to-page">
      <div className="to-wrap">
        <Link className="to-back" to="/"><ArrowLeft size={16} /> Back to event</Link>
        <div className="to-page-head">
          <p className="to-kicker is-gold">The Take Over · November 20</p>
          <h1>Choose your pass.</h1>
          <p className="to-lede">A pass is issued only after your payment has been reviewed and approved.</p>
        </div>
        {loading && <p className="to-state">Loading live passes…</p>}
        {error && <p className="to-state" role="status">{error}</p>}
        {!loading && !error && tickets.length > 0 && <PassGroups tickets={tickets} />}
        {!loading && !error && tickets.length === 0 && <p className="to-state">Passes are not available yet.</p>}
      </div>
    </main>
  )
}
