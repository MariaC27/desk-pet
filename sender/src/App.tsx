import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Home } from './Home'
import { SignIn } from './SignIn'
import { supabase } from './supabase'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <div className="page">
      {/* Signed out, the welcome card is the whole page. */}
      {session && (
        <header className="masthead">
          <img src="/favicon.png" alt="" width={36} height={36} />
          <span>Desk Pet</span>
          <span className="who">
            {session.user.email} ·{' '}
            <button className="link" onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          </span>
        </header>
      )}
      {session === undefined ? null : session ? <Home /> : <SignIn />}
    </div>
  )
}
