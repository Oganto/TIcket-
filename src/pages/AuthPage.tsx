import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type AuthMode = 'login' | 'signup' | 'reset' | 'update'

export function AuthPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const mode: AuthMode = location.pathname === '/signup' ? 'signup'
    : location.pathname === '/reset-password' ? 'reset'
      : location.pathname === '/update-password' ? 'update' : 'login'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!supabase) {
      setError('Authentication is unavailable until the Supabase project is configured.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'signup') {
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, phone } },
        })
        if (authError) throw authError
        setMessage('Check your email for a confirmation link to finish creating your account.')
      } else if (mode === 'reset') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/update-password`,
        })
        if (authError) throw authError
        setMessage('If an account exists for that email, a password reset link is on its way.')
      } else if (mode === 'update') {
        const { error: authError } = await supabase.auth.updateUser({ password })
        if (authError) throw authError
        setMessage('Your password has been updated. You can now log in with it.')
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw authError
        const redirectState = location.state as { from?: string; checkout?: unknown } | null
        if (redirectState?.from) navigate(redirectState.from, { state: redirectState.checkout })
        else navigate('/dashboard')
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to complete that request.')
    } finally {
      setBusy(false)
    }
  }

  const heading = mode === 'signup' ? 'Create your account'
    : mode === 'reset' ? 'Reset your password'
      : mode === 'update' ? 'Choose a new password' : 'Welcome back'

  return (
    <main className="to-page">
      <div className="to-auth">
        <Link className="to-back" to="/"><ArrowLeft size={16} /> Back to event</Link>
        <section className="to-panel">
          <p className="to-kicker is-gold">The Take Over</p>
          <h1>{heading}</h1>
          <form onSubmit={handleSubmit}>
            {mode === 'signup' && <label className="to-field">Full name<input required autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>}
            <label className="to-field">Email address<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            {mode === 'signup' && <label className="to-field">Phone number <span className="to-optional">Optional</span><input type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>}
            {mode !== 'reset' && <label className="to-field">{mode === 'update' ? 'New password' : 'Password'}<input type="password" required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
            {error && <p className="to-form-error" role="alert">{error}</p>}
            {message && <p className="to-form-success" role="status">{message}</p>}
            <button className="to-btn to-btn-block" disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : mode === 'update' ? 'Update password' : 'Log in'} <ArrowUpRight size={16} /></button>
          </form>
          <div className="to-alt">
            {mode === 'login' && <><Link to="/reset-password">Forgot password?</Link><span>New here? <Link to="/signup">Create an account</Link></span></>}
            {mode === 'signup' && <span>Already registered? <Link to="/login">Log in</Link></span>}
            {mode === 'reset' && <span>Remembered it? <Link to="/login">Log in</Link></span>}
            {mode === 'update' && <span><Link to="/login">Go to log in</Link></span>}
          </div>
        </section>
      </div>
    </main>
  )
}
