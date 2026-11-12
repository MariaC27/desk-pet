import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Gift } from './Gift'

// Entry for the public birthday page at /gift (gift/index.html). No sign-in, no Supabase.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Gift />
  </StrictMode>,
)
