import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { MAX_MESSAGE_LENGTH, supabase, type Device, type Message, type Recipient } from './supabase'

const REFRESH_MS = 20_000

const when = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const fmt = (iso: string) => when.format(new Date(iso))

export function RecipientView({ recipient, onRemoved }: { recipient: Recipient; onRemoved: () => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [devices, setDevices] = useState<Device[] | null>(null)

  const load = useCallback(async () => {
    const [m, d] = await Promise.all([
      supabase
        .from('messages')
        .select('id, body, created_at, delivered_at, read_at')
        .eq('recipient_id', recipient.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('devices')
        .select('id, created_at, last_seen_at')
        .eq('recipient_id', recipient.id)
        .order('created_at'),
    ])
    setMessages(m.data ?? [])
    setDevices(d.data ?? [])
  }, [recipient.id])

  // keep delivered/read ticks fresh while the page is open
  useEffect(() => {
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  return (
    <>
      <Compose recipient={recipient} paired={!!devices?.length} onSent={load} />
      {messages.length > 0 && <History messages={messages} onChange={load} />}
      {devices && <Pairing recipient={recipient} devices={devices} onChange={load} />}
      <RemoveRecipient recipient={recipient} onRemoved={onRemoved} />
    </>
  )
}

function Compose({ recipient, paired, onSent }: { recipient: Recipient; paired: boolean; onSent: () => void }) {
  const [body, setBody] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const remaining = MAX_MESSAGE_LENGTH - body.length

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setState('sending')
    const { error } = await supabase.from('messages').insert({ recipient_id: recipient.id, body: body.trim() })
    if (error) return setState('error')
    setBody('')
    setState('sent')
    onSent()
  }

  return (
    <section className="card">
      <h2>Write to {recipient.display_name}</h2>
      <form className="stack" onSubmit={submit}>
        <textarea
          rows={4}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Something nice…"
          value={body}
          onChange={(e) => {
            setBody(e.target.value)
            if (state !== 'sending') setState('idle')
          }}
        />
        <div className="row">
          <span className={remaining < 40 ? 'small warn' : 'small muted'}>{remaining} left</span>
          <button className="button primary" disabled={!body.trim() || state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Send'}
          </button>
        </div>
        {state === 'sent' && (
          <p className="success">
            {paired
              ? 'Sent! It shows up next time their plant checks in, usually within a couple of minutes.'
              : "Saved! It'll be waiting for them as soon as their Desk Pet is paired."}
          </p>
        )}
        {state === 'error' && <p className="error">Couldn't send that. Try again?</p>}
        {!paired && state !== 'sent' && (
          <p className="small muted">
            Not paired yet. You can still write now; messages wait until their Desk Pet connects.
          </p>
        )}
      </form>
    </section>
  )
}

function Status({ m }: { m: Message }) {
  if (m.read_at) return <span className="pill read">Read {fmt(m.read_at)}</span>
  if (m.delivered_at) return <span className="pill delivered">Delivered</span>
  return <span className="pill">Waiting</span>
}

function History({ messages, onChange }: { messages: Message[]; onChange: () => void }) {
  const [confirming, setConfirming] = useState<string | null>(null)

  const remove = async (id: string) => {
    await supabase.from('messages').delete().eq('id', id)
    setConfirming(null)
    onChange()
  }

  return (
    <section className="card">
      <h2>Sent</h2>
      <ul className="messages">
        {messages.map((m) => (
          <li key={m.id}>
            <p className="body">{m.body}</p>
            <div className="row small muted">
              <span>
                {fmt(m.created_at)} · <Status m={m} />
              </span>
              {confirming === m.id ? (
                <span>
                  Also removes it from their Messages.{' '}
                  <button className="link danger" onClick={() => remove(m.id)}>
                    Delete
                  </button>{' '}
                  <button className="link" onClick={() => setConfirming(null)}>
                    Keep
                  </button>
                </span>
              ) : (
                <button className="link subtle" onClick={() => setConfirming(m.id)}>
                  Delete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Pairing({ recipient, devices, onChange }: { recipient: Recipient; devices: Device[]; onChange: () => void }) {
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState('')

  const newCode = async () => {
    const { data, error } = await supabase.rpc('create_pairing_code', { rid: recipient.id })
    if (error || typeof data !== 'string') return setError("Couldn't make a code. Try again?")
    setError('')
    setCode(data)
  }

  const unpair = async (id: string) => {
    await supabase.from('devices').delete().eq('id', id)
    onChange()
  }

  return (
    <section className="card">
      <h2>Their Desk Pet</h2>
      {devices.length > 0 ? (
        <ul className="devices">
          {devices.map((d) => (
            <li key={d.id} className="row">
              <span className="small">
                Paired {fmt(d.created_at)}
                <span className="muted">
                  {' · '}
                  {d.last_seen_at ? `last checked in ${fmt(d.last_seen_at)}` : 'hasn’t checked in yet'}
                </span>
              </span>
              <button className="link subtle" onClick={() => unpair(d.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Not paired yet.</p>
      )}

      {code ? (
        <div className="code-box">
          <p className="small muted">Pairing code for {recipient.display_name}:</p>
          <p className="code">{code}</p>
          <p className="small muted">
            Enter it during Desk Pet's setup, or in Settings → Messages. It works once and expires in
            14 days. Making a new code cancels this one.
          </p>
        </div>
      ) : null}
      <button className="button" onClick={newCode}>
        {code ? 'Make a new code' : devices.length ? 'Pair another Mac' : 'Get a pairing code'}
      </button>
      {error && <p className="error">{error}</p>}
    </section>
  )
}

function RemoveRecipient({ recipient, onRemoved }: { recipient: Recipient; onRemoved: () => void }) {
  const [confirming, setConfirming] = useState(false)

  const remove = async () => {
    await supabase.from('recipients').delete().eq('id', recipient.id)
    onRemoved()
  }

  return (
    <p className="small muted center">
      {confirming ? (
        <>
          Remove {recipient.display_name}? This deletes all their messages and unpairs their Desk
          Pet.{' '}
          <button className="link danger" onClick={remove}>
            Remove
          </button>{' '}
          <button className="link" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </>
      ) : (
        <button className="link subtle" onClick={() => setConfirming(true)}>
          Remove {recipient.display_name}…
        </button>
      )}
    </p>
  )
}
