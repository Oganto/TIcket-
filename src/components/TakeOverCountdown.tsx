import { useEffect, useState } from 'react'

function remaining(target: number) {
  const diff = Math.max(0, target - Date.now())
  return {
    d: Math.floor(diff / 86_400_000),
    h: Math.floor((diff % 86_400_000) / 3_600_000),
    m: Math.floor((diff % 3_600_000) / 60_000),
    s: Math.floor((diff % 60_000) / 1000),
  }
}

/** Counts down to doors (9 PM Nigerian time) on the given YYYY-MM-DD date. */
export function TakeOverCountdown({ date }: { date: string }) {
  const target = new Date(`${date.slice(0, 10)}T21:00:00+01:00`).getTime()
  const valid = !Number.isNaN(target)
  const [time, setTime] = useState(() => remaining(target))

  useEffect(() => {
    if (!valid) return
    setTime(remaining(target))
    const timer = window.setInterval(() => setTime(remaining(target)), 1000)
    return () => window.clearInterval(timer)
  }, [target, valid])

  if (!valid) return null

  const cells = [
    { value: time.d, label: 'Days' },
    { value: time.h, label: 'Hours' },
    { value: time.m, label: 'Mins' },
    { value: time.s, label: 'Secs' },
  ]
  return (
    <div className="to-countdown" role="timer" aria-label="Time until doors open">
      <p className="to-kicker">Doors open in</p>
      <div className="to-countdown-grid">
        {cells.map((cell) => (
          <div className="to-countdown-cell" key={cell.label}>
            <b>{String(cell.value).padStart(2, '0')}</b>
            <span>{cell.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
