import { useEffect, useState } from 'react'
import type { PublicEvent } from '../hooks/usePublicEvent'

type TimeLeft = { days: number; hours: number; minutes: number; seconds: number }

function getTargetTime(event: PublicEvent) {
  if (!event.eventDate) return null
  const timeMatch = event.doors.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (!timeMatch) return null
  let hour = Number(timeMatch[1]) % 12
  if (timeMatch[3].toUpperCase() === 'PM') hour += 12
  const minute = Number(timeMatch[2] ?? 0)
  return new Date(`${event.eventDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+01:00`).getTime()
}

function getTimeLeft(target: number, now: number): TimeLeft {
  const secondsLeft = Math.max(0, Math.floor((target - now) / 1000))
  return {
    days: Math.floor(secondsLeft / 86400),
    hours: Math.floor((secondsLeft % 86400) / 3600),
    minutes: Math.floor((secondsLeft % 3600) / 60),
    seconds: secondsLeft % 60,
  }
}

export function EventCountdown({ event }: { event: PublicEvent }) {
  const targetTime = getTargetTime(event)
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    if (!targetTime) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [targetTime])

  const timeLeft = targetTime && now !== null ? getTimeLeft(targetTime, now) : undefined
  const passed = targetTime !== null && now !== null && targetTime <= now

  return (
    <section className="countdown" aria-label="Countdown to THE TAKE OVER" aria-live="off">
      <div className="countdown-heading"><span>COUNTDOWN TO THE NIGHT</span><i /></div>
      {passed ? <strong className="countdown-live">THE TAKE OVER</strong> : <div className="countdown-units">
        {(['days', 'hours', 'minutes', 'seconds'] as const).map((unit) => <div className="countdown-unit" key={unit}><strong>{timeLeft ? String(timeLeft[unit]).padStart(2, '0') : '--'}</strong><span>{unit}</span></div>)}
      </div>}
    </section>
  )
}