import { useEffect, useRef } from 'react'

export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const update = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      const progress = scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0
      if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    document.addEventListener('scroll', update, { passive: true, capture: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      document.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [])

  return <div className="scroll-progress" aria-hidden="true" ref={barRef} />
}