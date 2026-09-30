import { Tilt3D } from './Tilt3D'

type FlyerCard3DProps = {
  /** The published flyer from the event record. */
  src?: string
  alt: string
}

export function FlyerCard3D({ src, alt }: FlyerCard3DProps) {
  return (
    <Tilt3D className="to-flyer3d" cardClassName="to-flyer3d-card">
      {src
        ? <img src={src} alt={alt} draggable={false} />
        : <div className="to-flyer-fallback"><span>EKSU</span><strong>NOV 20</strong><em>TAKE OVER</em><small>CLUB LUNA</small></div>}
    </Tilt3D>
  )
}
