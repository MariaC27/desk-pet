import { useState } from "react";
import { emotionInfo } from "../lib/emotions";
import { markRead } from "../lib/messages";
import { openTracker } from "../lib/settings";
import { useAppData } from "./useAppData";

const when = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function MessagesTab() {
  const data = useAppData();

  if (!data) return null;
  const { pairing, messages } = data;

  if (pairing?.error === "unpaired") {
    return (
      <section className="stack">
        <div className="banner">
          <span>This Mac was unpaired, so new notes won't arrive. Ask for a new code to pair again.</span>
          <button className="button" onClick={() => openTracker("settings")}>
            Pair
          </button>
        </div>
        <MessageList messages={messages} />
      </section>
    );
  }

  if (!pairing) {
    return (
      <section className="stack">
        <div className="card empty">
          <p>Not paired for messages yet.</p>
          <p className="muted">
            Someone who cares about you can send little notes to your plant. If they gave you a
            pairing code, enter it in Settings.
          </p>
          <button className="button" onClick={() => openTracker("settings")}>
            Enter a code
          </button>
        </div>
      </section>
    );
  }

  if (!messages.length) {
    return (
      <section className="stack">
        <div className="card empty">
          <p>No notes yet.</p>
          <p className="muted">
            When one arrives, your plant lets you know: an envelope for a note, or a little show for
            a feeling. Click the plant to see it. Everything is kept here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="stack">
      <MessageList messages={messages} />
    </section>
  );
}

type Note = { id: string; body: string; mood: string | null; createdAt: string; readAt: string | null };

function MessageList({ messages }: { messages: Note[] }) {
  // Which notes are opened up in full. Unread ones stay sealed until clicked,
  // and opening one is what marks it read.
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (m: Note) => {
    const next = new Set(open);
    if (next.has(m.id)) next.delete(m.id);
    else next.add(m.id);
    setOpen(next);
    if (!m.readAt) markRead([m.id]);
  };

  return (
    <ul className="notes">
      {messages.map((m) => (
        <li key={m.id}>
          {m.readAt ? (
            <ReadNote note={m} expanded={open.has(m.id)} onClick={() => toggle(m)} />
          ) : (
            <button className="note card sealed" onClick={() => toggle(m)}>
              <p className="note-feeling">
                <span aria-hidden>💌</span> New message
              </p>
              <p className="muted small">
                {when.format(new Date(m.createdAt))} · Click to open
              </p>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function ReadNote({ note: m, expanded, onClick }: { note: Note; expanded: boolean; onClick: () => void }) {
  const hasBody = m.body.trim() !== "";
  return (
    <div
      className={expanded ? "note card" : "note card preview"}
      onClick={(e) => {
        // Let people select text in an opened note without it collapsing.
        if (expanded && window.getSelection()?.toString()) return;
        if (hasBody && (e.target as HTMLElement).tagName !== "A") onClick();
      }}
    >
      <div className="note-line">
        {m.mood && (
          <span className="feeling-tag">
            <span aria-hidden>{emotionInfo(m.mood)?.emoji}</span> {emotionInfo(m.mood)?.label}
          </span>
        )}
        {hasBody && <p className="note-body">{m.body}</p>}
      </div>
      <p className="muted small">{when.format(new Date(m.createdAt))}</p>
    </div>
  );
}
