import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { RecipientView } from './RecipientView'
import { supabase, type Recipient } from './supabase'

export function Home() {
  const [recipients, setRecipients] = useState<Recipient[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('recipients')
      .select('id, display_name, created_at')
      .order('created_at')
    setRecipients(data ?? [])
    return data ?? []
  }, [])

  useEffect(() => {
    load().then((list) => setSelected((s) => s ?? list[0]?.id ?? null))
  }, [load])

  if (!recipients) return null
  const current = recipients.find((r) => r.id === selected)

  return (
    <main className="stack">
      <nav className="chips">
        {recipients.map((r) => (
          <button
            key={r.id}
            className={r.id === selected ? 'chip active' : 'chip'}
            onClick={() => {
              setSelected(r.id)
              setAdding(false)
            }}
          >
            {r.display_name}
          </button>
        ))}
        <button className={adding || recipients.length === 0 ? 'chip active' : 'chip'} onClick={() => setAdding(true)}>
          + Add someone
        </button>
      </nav>

      {adding || recipients.length === 0 ? (
        <AddRecipient
          first={recipients.length === 0}
          onAdded={async (id) => {
            await load()
            setSelected(id)
            setAdding(false)
          }}
        />
      ) : current ? (
        <RecipientView
          key={current.id}
          recipient={current}
          onRemoved={async () => {
            const list = await load()
            setSelected(list[0]?.id ?? null)
          }}
        />
      ) : null}

      <a className="link subtle gift-link" href="/gift/" target="_blank" rel="noopener">
        Preview gift page ↗
      </a>
    </main>
  )
}

function AddRecipient({ first, onAdded }: { first: boolean; onAdded: (id: string) => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const { data, error } = await supabase
      .from('recipients')
      .insert({ display_name: name.trim() })
      .select('id')
      .single()
    if (error || !data) return setError("Couldn't add them. Try again?")
    onAdded(data.id)
  }

  return (
    <section className="card">
      <h2>{first ? 'Who are you sending notes to?' : 'Add someone'}</h2>
      <p className="muted">
        Each person gets their own pairing code and message history. Add one called "Me (test)" to
        try things out with your own Desk Pet.
      </p>
      <form className="row" onSubmit={submit}>
        <input
          required
          maxLength={60}
          placeholder="Their name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="button primary" disabled={!name.trim()}>
          Add
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  )
}
