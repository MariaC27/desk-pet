# Desk Pet — Implementation Plan

Source: `github_desk_pet_planning.md` (product doc). This file turns it into concrete decisions and a build order.
Target: gift-ready by **~Nov 15, 2026** (plan written Nov 2).

---

## 1. Decisions (locked)

| Topic | Decision |
|---|---|
| Pet | A cute pixel-art **potted plant** with a little face. |
| Desktop stack | **Tauri v2 + React + TypeScript + Vite**. |
| Backend | **Supabase** (Postgres + Auth + Edge Functions). |
| Activity metric | GitHub GraphQL `viewer.contributionsCollection.contributionCalendar` (daily contribution counts). Labelled **"contributions"** in the UI, not "commits". |
| Growth cadence | **Weekly reset**: the plant goes back to a seed at the moment Sunday 11:59 PM turns into Monday 12:00 AM (local time) and grows through the week as contributions come in. The app checks GitHub regularly through the day (§3). |
| GitHub auth | **OAuth App + Device Flow** (the user types a short code at github.com/login/device). No client secret ships in the app; any GitHub user can connect. |
| Who uses it | It's built for one recipient, but nothing is hardcoded. Any user can connect their GitHub account and pair with any sender (§5). |
| Launch at login | On by default. A checkbox during setup lets the user turn it off, and Settings has the same toggle. |
| Quitting | Menu bar has **Quit**. Hiding the pet is remembered between launches. Uninstalling means dragging the app to the Trash (plus the optional "Reset app" step). |
| Distribution | **GitHub Releases** (`.dmg`) plus a README with install steps. Ad-hoc signed, **not notarized** (no Apple Developer account). The first launch needs a one-time System Settings → Privacy & Security → "Open Anyway". |
| Dock | The app runs as a menu-bar app with no Dock icon. The Tracker window still behaves like a normal window. |

---

## 2. Architecture

```
desk-pet/
  app/                 Tauri app
    src-tauri/         Rust: windows, tray, autostart, keychain
    src/
      pet/             pet window (sprite renderer, state machine)
      tracker/         tracker + settings window
      onboarding/      first-run flow
      lib/             github.ts, messages.ts, growth.ts, store.ts
  supabase/
    migrations/        schema + RLS
    functions/         pair, messages (Edge Functions)
  sender/              static sender web page (Vite + supabase-js), hosted on GitHub Pages / Vercel
```

```
GitHub GraphQL <── token (keychain) ── macOS app ── device secret ──> Supabase Edge Functions ──> Postgres
                                                                                         ^
                                                         sender page (Supabase Auth) ────┘ (RLS)
```

- **Windows:**
  - `pet`: transparent, borderless, always-on-top (configurable), draggable, shows on all Spaces, remembers its position. Needs `macOSPrivateApi: true`.
  - `tracker`: a normal window, opened from the tray.
  - `onboarding`: a normal window, shown on first run.
- **Plugins:** `tray-icon` (core), `tauri-plugin-autostart`, `tauri-plugin-store` (settings + cached history), `tauri-plugin-http` (GitHub device-flow endpoints don't allow CORS), `tauri-plugin-notification`, `tauri-plugin-window-state`, and later `tauri-plugin-updater` (P1).
- **Secrets:** the GitHub token and the Supabase device secret live in the **macOS Keychain** (Rust `keyring` crate behind two small commands). They never go in the store file.

---

## 3. Growth model (weekly)

**The plant grows over one week, then starts over.** A week runs **Monday 00:00 to Sunday 23:59 in the user's local time**. The start day is a constant, so it's easy to change. At the start of each week the plant is a seed again, and it grows through stages as that week's contributions add up. The app checks GitHub regularly during the day (§6), so a new contribution shows up on the pet within minutes.

**Stage = contributions so far this week:**

| Stage | Name | This week's contributions |
|---|---|---|
| 0 | seed in pot | 0 |
| 1 | sprout | 1 |
| 2 | seedling | 3 |
| 3 | young plant | 6 |
| 4 | leafy | 10 |
| 5 | budding | 15 |
| 6 | flowering | 22 |
| 7 | full bloom | 30+ |

Above 30 there's no new stage. Instead the plant gets extra flowers or a ladybug, so it never "maxes out" awkwardly.

**Starting a new week:** it should feel like a fresh pot, not a loss. The new seed has a cheerful face. Last week's finished plant is saved to a **"Past weeks" garden** in the tracker, a row of small plant thumbnails. That's P1, but cheap to add because it reuses the same sprites.

**Weeks before install:** the tracker shows past weeks from the calendar data, so the garden isn't empty on day one.

**Moods** (shown on top of the stage):

| Mood | When |
|---|---|
| `idle` | Default: gentle sway, blinks. |
| `happy` | A contribution arrived since the last sync: leaves perk up, small sparkle. |
| `resting` | No contributions today or yesterday: sleepy, content face. Never sad or wilted. |
| `celebrating` | Reaching a new stage (a short grow animation), reaching full bloom (a bigger celebration), or a lifetime milestone (100 / 250 / 500 / 1000 contributions since install). |
| `offline` | Can't sync: a tiny cloud icon. The plant otherwise looks the same as its last known state. |
| `message` | An unread message: a little envelope (or butterfly) next to the pot. Clicking it opens the message. |

All thresholds live in one file, `lib/growth.ts`, so they're easy to tune. `growth.ts` is pure functions (calendar data in, stage/buds/mood out), so it's easy to unit-test.

---

## 4. Pixel art

- 48×48 sprites drawn at 3× scale (144px pet, with size options S/M/L), using `image-rendering: pixelated`.
- Sprites are written in code as palette + string grids. I'll draft them so they're easy to tweak, and any sprite can be swapped for a PNG later (Aseprite/Piskel).
- Minimum set:
  - 8 stages (one static frame each)
  - face overlays (idle, blink, happy, sleepy)
  - bud and flower overlays
  - a 2-frame sway
  - a celebration effect (sparkles/confetti, ~1.5s)
  - offline cloud and message envelope icons
  - a menu-bar template icon (16×16 monochrome)
- Motion stays subtle: a slow sway and occasional blinks. Celebrations are short and can be dismissed with a click.

---

## 5. Accounts, pairing and switching users

The same flow works for anyone. Testing it with your own account is identical to the real handoff.

**Sender side (sender page):**
1. The sender signs in with Supabase Auth (email magic link).
2. They create a **recipient** (e.g. "Alex") and get a **pairing code** like `PLANT-7Q4K-M2XD`: single-use, expires after 14 days, and can be regenerated.
3. The sender writes messages to that recipient. Messages are stored even before the app pairs.

**Recipient side (app onboarding):**
1. Welcome screen: "This plant grows with your GitHub contributions."
2. **Connect GitHub** using device flow: the app shows a code and opens github.com/login/device. Scope is `read:user`.
3. **Pair for messages** (optional, can be skipped): enter the pairing code. The `pair` Edge Function returns a long random **device secret**, which is stored in the Keychain. The database only stores its hash.
4. Choose launch-at-login (on by default) and pet size.
5. The seed appears on the desktop.

**Switching or testing users:**
- Settings → **Disconnect GitHub**: deletes the token and returns to the GitHub step. You can then connect a different account.
- Settings → **Unpair messages**: deletes the device secret.
- Settings → **Reset app…**: deletes everything (Keychain items, store, growth) and re-runs onboarding. This is how you test the full handoff on your own Mac.
- Dev builds use a different bundle id (`…desk-pet.dev`), so testing never touches the installed release app's data.

**Database (Supabase):**
- `recipients(id, owner_id → auth.users, display_name, created_at)`
- `pairing_codes(code_hash, recipient_id, expires_at, used_at)`
- `devices(id, recipient_id, secret_hash, created_at, last_seen_at, revoked_at)`
- `messages(id, recipient_id, body ≤ 500 chars, style, created_at, delivered_at, read_at)`

**Security:**
- RLS is on for every table. A sender can only read and write rows for their own recipients.
- The app never uses the anon key on tables. It only calls Edge Functions:
  - `pair`: code → device secret
  - `messages`: `GET` messages since a given point, `POST` acknowledge delivered/read
- These functions check the device secret hash.
- Sign-ups on the sender page can be invite-only if you want it locked down.

**Message delivery:**
- The app checks for messages every **2 minutes** while running, and right away on launch and when the Mac wakes.
- When a new message arrives: a macOS notification (can be turned off), the pet shows the envelope, and the message is saved in the tracker history.
- Messages stay on the server until they're delivered, so being offline or closed loses nothing.

---

## 6. Sync and error states

- GitHub sync runs on launch, **every 10 minutes**, on wake, and when you press "Sync now" in the tray. That's about 144 requests a day, far below GitHub's limit of 5000 per hour. It also catches the Monday reset at local midnight without needing a network call.
- The last successful calendar result is cached in the store, so the pet always renders from cached data even when offline.
- What the user sees for each problem:

| Problem | What the user sees |
|---|---|
| 401 from GitHub | "GitHub connection expired — Reconnect" in the tray and tracker. The pet stays as it was. |
| Network error | `offline` mood. Retries with backoff. Tray shows "Last synced 2h ago". |
| Rate limit | Wait until `reset` (very unlikely at this polling rate). |

- No raw error text ever appears in the UI. Details are logged to a file for debugging.

---

## 7. Build order

The schedule is tight, so each phase ends with something working.

### Phase 0 — Setup (Day 1, Nov 2–3)
- [ ] Install Rust (`rustup`). `git init`, create the GitHub repo.
- [ ] Scaffold the Tauri v2 app with React/TS.
- [ ] Register the GitHub OAuth App (device flow enabled) and get the client ID.
- [ ] Create the Supabase project.
- [ ] **Early check:** build a `.dmg`, download it on a different Mac or user account, and confirm it opens using the documented steps.

### Phase 1 — Pet prototype (Days 1–3)
- [ ] Transparent, draggable, always-on-top pet window that remembers its position and shows on all Spaces.
- [ ] Menu-bar icon: Show/Hide Pet, Open Tracker, Sync now, Settings, Quit.
- [ ] Launch at login, with the toggle working.
- [ ] Sprite renderer and placeholder art for all stages and moods.
- [ ] **Dev panel** (dev builds only): fake contributions, jump to any stage or mood, simulate a new week starting. Needed to see every state without waiting weeks.

**Exit:** a charming plant you can show, hide, move and quit.

### Phase 2 — GitHub activity (Days 3–6)
- [ ] Device-flow login and token stored in the Keychain.
- [ ] GraphQL calendar fetch, cache, and sync schedule.
- [ ] `growth.ts` (with unit tests), wired to the pet.
- [ ] Tracker tab 1, **Activity**:
  - this week's buds
  - a 12-week mini calendar
  - stage and progress to the next stage
  - milestones reached
  - last synced time
  - a "what counts as a contribution" note
- [ ] Error and reconnect states.

**Exit:** the pet reacts to your real GitHub activity.

### Phase 3 — Messages (Days 6–9)
- [ ] Supabase schema, RLS, and the `pair` / `messages` Edge Functions.
- [ ] Sender page: sign in, recipients list, generate pairing code, write/send a message, sent history with delivered/read ticks.
- [ ] App: pairing step in onboarding, polling, notification, envelope on the pet, Tracker tab 2 (**Messages**).
- [ ] Test: send while the app is quit, then launch and confirm it arrives. Send while offline, then reconnect and confirm.

**Exit:** a message sent from your phone shows up on the Mac.

### Phase 4 — Gift readiness (Days 9–13)
- [ ] Final pixel art pass, stage-up / full-bloom / milestone celebrations, "Past weeks" garden (P1).
- [ ] Onboarding polish, plus Settings: size, always-on-top, notifications, launch at login, disconnect, unpair, reset.
- [ ] README: install steps (with screenshots of the macOS "Open Anyway" step), how to quit or uninstall.
- [ ] Full test on a **clean macOS user account**: download → install → GitHub → pair → message → reboot (does it come back at login?) → reconnect.
- [ ] Cut the `v1.0.0` release.

### If time runs short, cut in this order
Updater, then extra decorations past stage 7, then message styles, then pet size options. **Never cut:** reset/switch user, offline caching, quitting.

---

## 8. Open items

1. ~~Apple Developer account~~ **Decided: no.** The README will walk through "Open Anyway" with screenshots. Test the exact download → open flow on a clean user account early.
2. **Auto-updates (P1):** the Tauri updater with GitHub Releases works even without Apple notarization (it uses its own signing key). Worth adding if Phase 4 has room, so you can ship fixes after the gift.
3. **Private contributions:** check during Phase 2 whether a `read:user` token includes private-repo contributions in the calendar, or only if the user has turned on "include private contributions" on their profile. Explain the answer in the tracker's "what counts" note.
4. **Day boundaries:** check whether GitHub's calendar groups days in the user's timezone or in UTC. If it's UTC, the Monday reset could include a few hours of Sunday-night contributions. Fix this by fetching with explicit `from`/`to` times based on local midnight.
5. **Sender page hosting:** GitHub Pages (free, static) is the default.
