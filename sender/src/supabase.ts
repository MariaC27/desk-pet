import { createClient } from '@supabase/supabase-js'

// Public values (the publishable key is meant to ship in client code; access
// is enforced by row level security in supabase/migrations).
const SUPABASE_URL = 'https://tuvacbefvbhvnuyeoogu.supabase.co'
const SUPABASE_KEY = 'sb_publishable_fxKVI6nIUKcUfPOtUeQaYw_gTrLXaV_'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  // Implicit flow: the sign-in link works even if opened in a different browser.
  auth: { flowType: 'implicit' },
})

export const MAX_MESSAGE_LENGTH = 500

export interface Recipient {
  id: string
  display_name: string
  created_at: string
}

export interface Device {
  id: string
  created_at: string
  last_seen_at: string | null
}

export interface Message {
  id: string
  body: string
  created_at: string
  delivered_at: string | null
  read_at: string | null
}
