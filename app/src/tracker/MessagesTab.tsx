import { useEffect, useRef } from "react";
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
  // Messages that were unread when this tab opened keep their "New" badge
  // while it stays open, even after being marked read.
  const newIds = useRef<Set<string> | null>(null);

  const unread = data?.messages.filter((m) => !m.readAt).map((m) => m.id) ?? [];
  const unreadKey = unread.join();

  // Mark read only once they're actually in front of the person (window focused).
  useEffect(() => {
    if (!data || !unread.length) return;
    const read = () => {
      newIds.current = new Set([...(newIds.current ?? []), ...unread]);
      markRead(unread);
    };
    if (document.hasFocus()) return read();
    window.addEventListener("focus", read, { once: true });
    return () => window.removeEventListener("focus", read);
  }, [data !== null, unreadKey]);

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
        <MessageList messages={messages} newIds={newIds.current} />
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
            When one arrives, a little envelope appears next to your plant. Every note is kept here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="stack">
      <MessageList messages={messages} newIds={newIds.current} />
    </section>
  );
}

function MessageList({
  messages,
  newIds,
}: {
  messages: { id: string; body: string; createdAt: string }[];
  newIds: Set<string> | null;
}) {
  return (
    <ul className="notes">
      {messages.map((m) => (
        <li key={m.id} className={newIds?.has(m.id) ? "note card new" : "note card"}>
          <p className="note-body">{m.body}</p>
          <p className="muted small">
            {when.format(new Date(m.createdAt))}
            {newIds?.has(m.id) && <span className="badge">New</span>}
          </p>
        </li>
      ))}
    </ul>
  );
}
