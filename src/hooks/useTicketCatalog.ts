import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type TicketGroup = 'Regular' | 'Premium' | 'Tables'

export type CatalogTicket = {
  id: string
  eventId: string
  name: string
  description: string
  price: number
  available: number
  group: TicketGroup
  featured: boolean
}

function getGroup(name: string): TicketGroup {
  if (/table/i.test(name)) return 'Tables'
  if (/vip/i.test(name)) return 'Premium'
  return 'Regular'
}

export function formatNaira(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function useTicketCatalog() {
  const [tickets, setTickets] = useState<CatalogTicket[]>([])
  const [eventId, setEventId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadCatalog() {
      if (!supabase) {
        setError('Ticket catalog is not connected.')
        setLoading(false)
        return
      }

      const { data: event, error: eventError } = await supabase.from('events')
        .select('id').eq('status', 'published')
        .order('updated_at', { ascending: false }).limit(1).maybeSingle()
      if (!active) return
      if (eventError) {
        setError('Ticket catalog could not be loaded. Please try again.')
        setLoading(false)
        return
      }
      if (!event) {
        setError('Tickets are not on sale yet.')
        setLoading(false)
        return
      }

      setEventId(event.id)
      const { data, error: ticketsError } = await supabase.from('ticket_types')
        .select('id,event_id,name,description,price,quantity_available,quantity_sold')
        .eq('event_id', event.id).eq('status', 'active').order('price')
      if (!active) return
      if (ticketsError) {
        setError('Ticket catalog could not be loaded. Please try again.')
      } else {
        setTickets((data ?? []).map((ticket) => ({
          id: ticket.id,
          eventId: ticket.event_id,
          name: ticket.name,
          description: ticket.description ?? '',
          price: Number(ticket.price),
          available: Math.max(0, ticket.quantity_available - ticket.quantity_sold),
          group: getGroup(ticket.name),
          featured: ticket.name.trim().toLowerCase() === 'vip',
        })))
      }
      setLoading(false)
    }
    void loadCatalog()
    return () => { active = false }
  }, [])

  return { tickets, eventId, loading, error }
}