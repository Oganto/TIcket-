import { useEffect, useRef, useState } from 'react'
import type { IScannerControls } from '@zxing/browser'
import { ArrowLeft, Camera, Check, CircleAlert, ScanLine, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Verification = {
  result: 'valid' | 'used' | 'invalid'
  ticket_id?: string
  ticket_code?: string
  checked_in_at?: string | null
  event_name?: string
  event_date?: string | null
  event_time?: string | null
  venue?: string
  ticket_type?: string
  customer_name?: string
}

function getQrValue(scannedText: string) {
  try {
    const url = new URL(scannedText)
    return url.pathname.split('/').filter(Boolean).at(-1) ?? scannedText
  } catch {
    return scannedText.trim()
  }
}

export function VerifyPage() {
  const { ticketCode } = useParams()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | undefined>(undefined)
  const [code, setCode] = useState(ticketCode ?? '')
  const [result, setResult] = useState<Verification>()
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (ticketCode) void verify(ticketCode)
    return () => controlsRef.current?.stop()
  }, [ticketCode])

  async function verify(value: string) {
    const qrValue = getQrValue(value)
    setCode(qrValue)
    setLoading(true)
    setError('')
    setResult(undefined)
    if (!supabase) {
      setError('Connect the Supabase project to verify tickets.')
      setLoading(false)
      return
    }
    const { data, error: rpcError } = await supabase.rpc('verify_ticket', { p_qr_value: qrValue })
    if (rpcError) setError(rpcError.message)
    else setResult(data as Verification)
    setLoading(false)
  }

  async function startCamera() {
    setError('')
    setScanning(true)
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      const reader = new BrowserQRCodeReader()
      controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (scanResult) => {
        if (!scanResult) return
        controlsRef.current?.stop()
        setScanning(false)
        void verify(scanResult.getText())
      })
    } catch (cameraError) {
      setScanning(false)
      setError(cameraError instanceof Error ? cameraError.message : 'Camera access is unavailable.')
    }
  }

  async function checkIn() {
    if (!supabase || !code) return
    setLoading(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('check_in_ticket', { p_qr_value: code })
    if (rpcError) setError(rpcError.message)
    else setResult(data as Verification)
    setLoading(false)
  }

  return (
    <main className="verify-page">
      <Link className="back-link" to="/"><ArrowLeft size={16} /> Event site</Link>
      <section className="verify-panel">
        <div className="checkout-icon"><ScanLine size={24} /></div>
        <p className="eyebrow"><span className="eyebrow-rule" /> ENTRY CHECK-IN</p>
        <h1>Verify ticket</h1>
        <button className="scan-button" onClick={() => void startCamera()} disabled={scanning}><Camera size={17} /> {scanning ? 'Camera active' : 'Scan QR code'}</button>
        <video className={scanning ? 'scanner-video visible' : 'scanner-video'} ref={videoRef} muted playsInline />
        <div className="manual-code"><input aria-label="Ticket verification code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Paste the QR value" /><button onClick={() => void verify(code)} disabled={loading || !code}>Check</button></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading && <p className="state-message">Checking ticket…</p>}
        {result && <section className={`verification-result result-${result.result}`} aria-live="polite">
          <h2>{result.result === 'valid' ? 'VALID TICKET' : result.result === 'used' ? 'TICKET ALREADY USED' : 'INVALID TICKET'}</h2>
          {result.result !== 'invalid' && <dl>{[['Ticket', result.ticket_code], ['Customer', result.customer_name], ['Event', result.event_name], ['Ticket type', result.ticket_type], ['Date', result.event_date], ['Time', result.event_time], ['Venue', result.venue]].filter((item) => item[1]).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
          {result.result === 'valid' && <button className="button button-dark checkin-button" onClick={() => void checkIn()} disabled={loading}><Check size={16} /> Mark as checked in</button>}
          {result.result === 'used' && result.checked_in_at && <p className="checkin-time">Previously checked in {new Date(result.checked_in_at).toLocaleString()}</p>}
          {result.result === 'invalid' && <CircleAlert size={20} />}
        </section>}
        <p className="verify-note"><ShieldCheck size={14} /> Verification and check-in are confirmed against the event database.</p>
      </section>
    </main>
  )
}