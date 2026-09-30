import { useRef, useState } from 'react'
import type { CSSProperties, PointerEvent, ReactNode } from 'react'

type Tilt3DProps = {
  children: ReactNode
  /** Class for the perspective wrapper */
  className?: string
  /** Class for the element that actually rotates */
  cardClassName?: string
  /** Maximum tilt in degrees */
  max?: number
  /** Scale while the pointer is on the card */
  scale?: number
  /** Gentle idle sway so the 3D is visible on phones before anyone touches it */
  sway?: boolean
}

export function Tilt3D({ children, className = '', cardClassName = '', max = 10, scale = 1.04, sway = true }: Tilt3DProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState<{ x: number; y: number } | null>(null)

  function move(pointerEvent: PointerEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const px = (pointerEvent.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
    const py = (pointerEvent.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
    setTilt({
      x: Math.max(-1, Math.min(1, py)) * -max,
      y: Math.max(-1, Math.min(1, px)) * max,
    })
  }

  const cardStyle: CSSProperties | undefined = tilt
    ? ({
        transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${scale})`,
        '--to-shine-x': `${50 + tilt.y * 2.5}%`,
        '--to-shine-y': `${50 - tilt.x * 2.5}%`,
      } as CSSProperties)
    : undefined

  return (
    <div
      ref={ref}
      className={`to-tilt ${tilt ? 'is-active' : ''} ${sway ? 'has-sway' : ''} ${className}`.trim()}
      onPointerDown={move}
      onPointerMove={move}
      onPointerLeave={() => setTilt(null)}
      onPointerCancel={() => setTilt(null)}
      onPointerUp={(pointerEvent) => { if (pointerEvent.pointerType !== 'mouse') setTilt(null) }}
    >
      <div className={`to-tilt-card ${cardClassName}`.trim()} style={cardStyle}>
        {children}
        <span className="to-tilt-shine" aria-hidden="true" />
      </div>
    </div>
  )
}
