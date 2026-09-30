import { useEffect, useState } from 'react'
import { ArrowUpRight, CalendarDays, FileUp, Landmark, Mail, MapPin, Phone, Ticket } from 'lucide-react'
import { Link } from 'react-router-dom'
import { FlyerCard3D } from '../components/FlyerCard3D'
import { PassGroups } from '../components/PassGroups'
import { TakeOverCountdown } from '../components/TakeOverCountdown'
import { usePublicEvent } from '../hooks/usePublicEvent'
import { useTicketCatalog } from '../hooks/useTicketCatalog'

function HighlightVideo() {
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return (
    <video
      autoPlay={reducedMotion === false}
      controls
      loop
      muted
      playsInline
      preload="metadata"
      aria-label="THE TAKE OVER Club Luna highlight video"
    >
      <source src="/highlights/watch.mp4" type="video/mp4" />
    </video>
  )
}

const steps = [
  { icon: Ticket, title: 'Choose', text: 'Pick your pass and how many you need.' },
  { icon: Landmark, title: 'Pay', text: 'Send the exact amount by bank transfer.' },
  { icon: FileUp, title: 'Upload proof', text: 'Add a screenshot of your receipt for review.' },
  { icon: Mail, title: 'Get your QR', text: 'Once approved, your QR ticket is emailed to you.' },
]

export function HomePage() {
  const event = usePublicEvent()
  const catalog = useTicketCatalog()
  const marquee = 'ONE CAMPUS · ONE NIGHT · NO LIMIT · CLUB LUNA · EKSU ·'

  return (
    <main className="to-page">
      {event.homeBackgroundUrl && <div className="to-hero-bg" style={{ backgroundImage: `url("${event.homeBackgroundUrl}")` }} aria-hidden="true" />}

      <section className="to-hero">
        <div className="to-enter">
          <span className="to-pill"><i />One night only · {event.date}</span>
          <p className="to-presenters">{event.presenters[0]} × {event.presenters[1]} present</p>
          <h1 className="to-title" aria-label={event.name}>
            <span>THE</span>
            <span className="is-gold">TAKE</span>
            <span>OVER</span>
          </h1>
          <p className="to-tagline">One campus · One night · No limit</p>
          <div className="to-facts">
            <div className="to-fact"><CalendarDays size={20} /><span><strong>{event.date}</strong><small>Doors open 9:00 PM</small></span></div>
            <div className="to-fact"><MapPin size={20} /><span><strong>{event.venue}</strong><small>{event.venueDetail}</small></span></div>
          </div>
          <div className="to-perks">{event.extras.map((extra) => <span className="to-perk" key={extra}>✦ {extra}</span>)}</div>
          <div className="to-cta-row">
            <Link className="to-btn" to="/tickets">Get your ticket <ArrowUpRight size={17} /></Link>
            <a className="to-btn to-btn-ghost" href={`tel:${event.contacts[0]}`}>Enquiries</a>
          </div>
        </div>

        <div className="to-hero-art">
          <FlyerCard3D src={event.imageUrl} alt={`${event.name} official event flyer`} />
          <TakeOverCountdown date={String(event.eventDate ?? '2026-11-20')} />
        </div>
      </section>

      <div className="to-marquee" aria-hidden="true">
        <div className="to-marquee-track"><span>{marquee}</span><span>{marquee}</span><span>{marquee}</span><span>{marquee}</span></div>
      </div>

      <section className="to-section" id="tickets">
        <div className="to-section-head">
          <div><p className="to-kicker is-gold">Passes</p><h2 className="to-h2">Choose your pass</h2></div>
          <p className="to-lede">Live prices and availability. A pass is issued once your payment is approved.</p>
        </div>
        {catalog.loading ? <p className="to-state">Loading live passes…</p>
          : catalog.error ? <p className="to-state">{catalog.error}</p>
            : catalog.tickets.length === 0 ? <p className="to-state">Passes are not available yet.</p>
              : <PassGroups tickets={catalog.tickets} extraState={{ eventDate: event.eventDate, venue: `${event.venue}, ${event.venueDetail}` }} />}
      </section>

      <section className="to-section">
        <div className="to-section-head">
          <div><p className="to-kicker is-gold">How it works</p><h2 className="to-h2">Four steps to the door</h2></div>
        </div>
        <ol className="to-steps4">
          {steps.map(({ icon: Icon, title, text }, index) => (
            <li className="to-step4" key={title}><Icon size={22} /><b>{String(index + 1).padStart(2, '0')} · {title}</b><p>{text}</p></li>
          ))}
        </ol>
      </section>

      <section className="to-section" id="highlights">
        <div className="to-section-head">
          <div><p className="to-kicker is-gold">On the night</p><h2 className="to-h2">Feel the vibe</h2></div>
          <div className="to-perks" style={{ marginBottom: 0 }}>{event.extras.map((extra) => <span className="to-perk" key={extra}>✦ {extra}</span>)}</div>
        </div>
        <div className="to-video-frame">
          <HighlightVideo />
          <span className="to-video-label">CLUB LUNA</span>
        </div>
      </section>

      <section className="to-section">
        <div className="to-contact">
          <div><p className="to-kicker is-gold">Enquiries · Sponsorship · Collaboration</p><h2>Talk to the organizers.</h2></div>
          <div className="to-contact-numbers">{event.contacts.map((number) => <a key={number} href={`tel:${number}`}><Phone size={15} />{number}</a>)}</div>
        </div>
      </section>
    </main>
  )
}
