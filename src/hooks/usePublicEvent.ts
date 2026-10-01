import { useEffect, useState } from 'react'
import { event as flyerEvent } from '../data/event'
import { supabase } from '../lib/supabase'

export type PublicEvent = {
  id?: string
  name: string
  tagline: string
  date: string
  eventDate?: string
  doors: string
  venue: string
  venueDetail: string
  imageUrl?: string
  presenters: readonly string[]
  extras: readonly string[]
  contacts: readonly string[]
  homeBackgroundUrl?: string
}

function getHomeBackgroundUrl() {
  return supabase
    ? supabase.storage.from('event-assets').getPublicUrl(flyerEvent.homeBackgroundPath).data.publicUrl
    : undefined
}

export function usePublicEvent() {
  const [currentEvent, setCurrentEvent] = useState<PublicEvent>(() => ({ ...flyerEvent, homeBackgroundUrl: getHomeBackgroundUrl() }))

  useEffect(() => {
    let alive = true
    async function loadEvent() {
      if (!supabase) return
      const { data } = await supabase.from('events')
        .select('id,name,description,event_date,event_time,venue,image_path')
        .eq('status', 'published').order('updated_at', { ascending: false }).limit(1).maybeSingle()
      if (!alive || !data) return
      const formattedDate = data.event_date
        ? new Date(`${data.event_date}T12:00:00`).toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })
        : flyerEvent.date
      const [venue, ...venueDetail] = data.venue.split(',')
      setCurrentEvent({
        ...flyerEvent,
        id: data.id,
        name: data.name,
        tagline: data.description || flyerEvent.tagline,
        date: formattedDate,
        eventDate: data.event_date || undefined,
        doors: data.event_time || flyerEvent.doors,
        venue: venue.trim() || flyerEvent.venue,
        venueDetail: venueDetail.join(',').trim() || flyerEvent.venueDetail,
        imageUrl: data.image_path
          ? supabase.storage.from('event-assets').getPublicUrl(data.image_path).data.publicUrl
          : undefined,
        homeBackgroundUrl: getHomeBackgroundUrl(),
      })
    }
    void loadEvent()
    return () => { alive = false }
  }, [])

  return currentEvent
}