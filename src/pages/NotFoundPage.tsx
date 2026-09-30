import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="not-found-page">
      <p className="night-kicker">THE TAKE OVER · EKSU</p>
      <h1>Page not found.</h1>
      <p>That address doesn’t lead to an event page.</p>
      <Link className="night-button" to="/"><ArrowLeft size={17} /> Back home</Link>
    </main>
  )
}