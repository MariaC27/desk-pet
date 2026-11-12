import { useEffect, useRef, useState } from 'react'
// The app's own pixel art, so the gift shows the real plant. Type-only import of the app's
// emotions, so nothing else from the app is bundled.
import { composePet, H, W, type PlantStyle } from '../../app/src/pet/sprite'
import './gift.css'

// Birthday gift page at /gift (its own entry: gift/index.html -> gift-main.tsx), public, opened from
// the QR code on the card. A pixel present opens into a growing Desk Pet, then what it is and how to
// set it up. The admin page links here as "Preview gift page".

const N = 64 // canvas width in sprite pixels; the sprite sits centered at the bottom
const TOP = 16 // empty rows above the sprite that are cropped off, so the art sits close to the heading
const NH = N - TOP // canvas height
const OX = (N - W) / 2
const OY = N - H - 2 - TOP
// a kraft-paper box tied with green ribbon, like a plant from the nursery
const C = { o: '#4a3432', box: '#c99c6e', boxS: '#a87c52', boxH: '#e2c29a', rib: '#6cb35a', ribS: '#3f7a3a' }
const CONFETTI = ['#9bd977', '#6cb35a', '#3f7a3a', '#d9825b', '#fff5d6']
const STYLES: { id: PlantStyle; label: string }[] = [
  { id: 'blossom', label: 'Blossom' },
  { id: 'cactus', label: 'Cactus' },
  { id: 'aloe', label: 'Aloe' },
]
const REVEAL_MS = 2400 // lid off, box away, plant grows; then the text comes in

type Particle = { x: number; y: number; vx: number; vy: number; c: string; life: number }

export function Gift() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const plant = useRef<PlantStyle>('blossom')
  const openedAt = useRef<number | null>(null)
  const celebrateAt = useRef<number | null>(null)
  const parts = useRef<Particle[]>([])
  const [style, setStyle] = useState<PlantStyle>('blossom')
  const [opened, setOpened] = useState(false) // present clicked
  const [open, setOpen] = useState(false) // reveal finished, text shown
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!
    const rect = (x: number, y: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c
      ctx.fillRect(Math.round(x), Math.round(y), w, h)
    }
    // a 1px-outlined block with a shaded right edge and an optional highlight on top
    const block = (x: number, y: number, w: number, h: number, fill: string, shade: string, hi?: string) => {
      rect(x, y, w, h, C.o)
      rect(x + 1, y + 1, w - 2, h - 2, fill)
      rect(x + w - 4, y + 1, 3, h - 2, shade)
      if (hi) rect(x + 1, y + 1, w - 5, 1, hi)
    }
    const box = (dy: number) => {
      block(17, 40 + dy, 30, 22, C.box, C.boxS, C.boxH)
      rect(30, 41 + dy, 4, 20, C.rib)
      rect(33, 41 + dy, 1, 20, C.ribS)
    }
    const lid = (dx: number, dy: number) => {
      block(14 + dx, 34 + dy, 36, 7, C.box, C.boxS, C.boxH)
      rect(30 + dx, 35 + dy, 4, 5, C.rib)
      rect(33 + dx, 35 + dy, 1, 5, C.ribS)
      // bow: two loops and a knot
      block(23 + dx, 28 + dy, 8, 7, C.rib, C.ribS)
      block(33 + dx, 28 + dy, 8, 7, C.rib, C.ribS)
      rect(26 + dx, 31 + dy, 2, 1, C.o)
      rect(36 + dx, 31 + dy, 2, 1, C.o)
      block(30 + dx, 30 + dy, 4, 5, C.ribS, C.ribS)
    }
    const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3)

    let raf = 0
    const frame = (now: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, N, NH)
      ctx.translate(0, -TOP)
      if (openedAt.current == null) {
        const hop = now % 2600 < 180 ? -2 : 0
        box(hop)
        lid(0, hop)
      } else {
        const t = reduce ? 1e6 : now - openedAt.current
        const stage = Math.max(0, Math.min(7, Math.floor((t - 450) / 260)))
        const cel = celebrateAt.current
        const celebrating = cel != null && now >= cel && now - cel < 9000
        composePet(
          {
            plant: plant.current,
            stage,
            extraBlooms: 0,
            ladybug: stage === 7,
            mood: 'happy',
            emotion: celebrating ? 'celebrate' : null,
            offline: false,
            hasNote: false,
          },
          { t: now, blink: now % 4200 < 140, emotionAge: celebrating ? now - cel : 1e6 },
        ).forEach((col, i) => {
          if (col) rect(OX + (i % W), OY + TOP + Math.floor(i / W), 1, 1, col)
        })
        if (t < 900) box(ease((t - 250) / 600) * 30)
        if (t < 700) {
          ctx.globalAlpha = 1 - ease((t - 350) / 350)
          lid(ease(t / 600) * 10, -ease(t / 600) * 30)
          ctx.globalAlpha = 1
        }
      }
      parts.current = parts.current.filter((p) => (p.life -= 1) > 0)
      for (const p of parts.current) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.05
        rect(p.x, p.y, 1, 1, p.c)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [reduce])

  const burst = () => {
    if (reduce) return
    for (let i = 0; i < 46; i++)
      parts.current.push({
        x: 32,
        y: 34,
        vx: (Math.random() - 0.5) * 1.6,
        vy: -1.2 - Math.random() * 1.4,
        c: CONFETTI[i % CONFETTI.length],
        life: 60 + Math.random() * 40,
      })
  }

  const onStage = () => {
    const now = performance.now()
    if (openedAt.current == null) {
      openedAt.current = now
      setOpened(true)
      celebrateAt.current = now + REVEAL_MS - 100
      burst()
      setTimeout(() => setOpen(true), reduce ? 0 : REVEAL_MS)
    } else {
      celebrateAt.current = now
      burst()
    }
  }

  return (
    <div className={open ? 'gift open' : 'gift'}>
      <main className="gift-main">
        <h1>{opened ? 'Happy Birthday!' : 'I made you something...'}</h1>
        <button
          type="button"
          className="gift-stage"
          onClick={onStage}
          aria-label={opened ? 'Celebrate with the plant' : 'Open the present'}
        >
          <canvas ref={canvas} width={N} height={NH} />
        </button>
        <p className="gift-hint">{open ? 'Tap to celebrate again' : 'Tap to open'}</p>

        {open && (
          <section className="gift-reveal">
            <div className="gift-styles" role="group" aria-label="Plant style">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={style === s.id}
                  onClick={() => {
                    plant.current = s.id
                    setStyle(s.id)
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <h2>It's the Desk Pet I've been (unsuccessfully) hiding! </h2>
            <p className="gift-lede">
              I made you a little plant that lives on your desktop and grows with your GitHub contributions. It can also receive 
              messages and emotions from me. Why am I enabling your "commit maxxing"...
            </p>

            <div className="gift-window">
              <div className="gift-bar">
                <i />
                <i />
                <i />
                <span>Desk Pet</span>
              </div>
              <ul className="gift-feats">
                <li>
                  <b>Grows with your weekly contributions</b>
                  <p>Syncs with github every few minutes to update. It goes back to a seed every Saturday at midnight.</p>
                </li>
                <li>
                  <b>Lives on your desktop</b>
                  <p>Drag it anywhere. Double-click it to see your contribution graph, settings, and messages from me.</p>
                </li>
                <li>
                  <b>Gets notes and emotions from me</b>
                  <p>Once it's paired, I can send you little notes and feelings, and your plant acts them out.</p>
                </li>
              </ul>
              <div className="gift-setup">
                <b>Set it up with me</b>
                <p>Bring your laptop... I have a pairing code.</p>
                <a href="https://github.com/MariaC27/desk-pet" target="_blank" rel="noopener noreferrer">
                  See it on GitHub →
                </a>
              </div>
            </div>
            <p className="gift-sign">Love, Maria</p>
            <svg className="gift-heart" viewBox="0 0 7 6" width="42" height="36" shapeRendering="crispEdges" aria-hidden="true">
              <path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z" fill="#4a3432" />
              <path d="M1 1h2v1h1V1h2v2H5v1H4v1H3V4H2V3H1z" fill="#ef7fae" />
              <path d="M1 1h1v1H1z" fill="#ffb3d1" />
            </svg>
          </section>
        )}
      </main>
      <footer className="gift-footer">{new Date().getFullYear()}</footer>
    </div>
  )
}
