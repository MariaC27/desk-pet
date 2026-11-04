import { useRoute } from "../lib/route";
import type { TrackerTab } from "../lib/settings";
import { ActivityTab } from "./ActivityTab";
import { DevPanel } from "./DevPanel";
import { MessagesTab } from "./MessagesTab";
import { SettingsTab } from "./SettingsTab";

const TABS: { id: TrackerTab; label: string }[] = [
  { id: "activity", label: "Activity" },
  { id: "messages", label: "Messages" },
  { id: "settings", label: "Settings" },
  ...(import.meta.env.DEV ? [{ id: "dev" as const, label: "Dev" }] : []),
];

export function TrackerWindow() {
  const [tab, setTab] = useRoute<TrackerTab>("activity");

  return (
    <div className="tracker">
      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "tab active" : "tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <main className="panel">
        {tab === "activity" && <ActivityTab />}
        {tab === "messages" && <MessagesTab />}
        {tab === "settings" && <SettingsTab />}
        {tab === "dev" && <DevPanel />}
      </main>
    </div>
  );
}
