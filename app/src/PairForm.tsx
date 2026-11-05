import { useState, type FormEvent } from "react";
import { MessagesError, pair } from "./lib/messages";

const ERROR_TEXT: Record<string, string> = {
  invalid_code:
    "That code didn't work. Check for typos, or ask for a new one (codes work once and expire after 14 days).",
  offline: "Couldn't reach the server. Check your internet connection and try again.",
};

/** Enter a pairing code from the sender page. */
export function PairForm({ onPaired }: { onPaired: (recipientName: string | null) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onPaired(await pair(code));
    } catch (err) {
      const kind = err instanceof MessagesError ? err.kind : "unknown";
      setError(ERROR_TEXT[kind] ?? "Something went wrong pairing. Try again?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack wide" onSubmit={submit}>
      <div className="row">
        <input
          className="code-input"
          placeholder="PLANT-XXXX-XXXX"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <button className="button primary" disabled={busy || code.replace(/[^A-Z0-9]/gi, "").length < 8}>
          {busy ? "Pairing…" : "Pair"}
        </button>
      </div>
      {error && <p className="error small">{error}</p>}
    </form>
  );
}
