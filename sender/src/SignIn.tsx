import { useState, type FormEvent } from 'react'
import { PixelEnvelope } from './PixelEnvelope'
import { supabase } from './supabase'

export function SignIn() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setState('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      // Senders are invite-only: never create an account from this form.
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    })
    if (!error) return setState('sent')
    setState('error')
    setError(
      /signups? not allowed|not found/i.test(error.message)
        ? "That email isn't set up to send notes."
        : /rate limit/i.test(error.message)
          ? 'Too many sign-in emails just now. Wait a few minutes and try again.'
          : "Couldn't send the sign-in email. Try again?",
    )
  }

  if (state === 'sent') {
    return (
      <main className="card narrow center welcome">
        <PixelEnvelope />
        <h1 className="pixel-title">Check your inbox</h1>
        <p className="muted">
          We sent a sign-in link to <strong>{email}</strong>. Open it on this device to continue.
        </p>
        <button className="link" onClick={() => setState('idle')}>
          Use a different email
        </button>
      </main>
    )
  }

  return (
    <main className="card narrow center welcome">
      <PixelEnvelope />
      <h1 className="pixel-title">Welcome to Desk Pet</h1>
      <p className="muted">Sign in to send little notes and feelings to someone's desk plant.</p>
      <form className="stack" onSubmit={submit}>
        <input
          type="email"
          required
          autoFocus
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="button primary" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
        </button>
        {state === 'error' && <p className="error">{error}</p>}
      </form>
    </main>
  )
}
