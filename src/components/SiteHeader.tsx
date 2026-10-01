import { ArrowUpRight, Menu, Ticket, X } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

export function SiteHeader() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => setMenuOpen(false), [location.pathname, location.hash])

  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="The Take Over home">
        <span className="brand-mark"><Ticket size={18} strokeWidth={2.4} /></span>
        <span className="brand-name">THE TAKE OVER<span>EKSU · NOV 20</span></span>
      </Link>
      <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation" id="guest-navigation">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/tickets">Tickets</NavLink>
        <Link to="/#about">About</Link>
        <Link to="/#highlights">Highlights</Link>
      </nav>
      <div className="header-actions">
        <Link className="header-action" to="/tickets">Get ticket <ArrowUpRight size={16} /></Link>
        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          aria-controls="guest-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </header>
  )
}