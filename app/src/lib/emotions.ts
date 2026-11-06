// Feelings a sender can send; the plant acts them out (face + effects) until
// it's clicked. Keep in sync with the `mood` check in supabase/migrations and
// sender/src/emotions.ts.
export const EMOTIONS = [
  { id: "love", emoji: "💗", label: "Sending love", notify: "Someone's sending you love 💗" },
  { id: "proud", emoji: "🌟", label: "Proud of you", notify: "Someone's proud of you 🌟" },
  { id: "luck", emoji: "🍀", label: "Good luck", notify: "Good luck! 🍀" },
  { id: "break", emoji: "☕", label: "Take a break", notify: "Time for a little break ☕" },
  { id: "celebrate", emoji: "🎉", label: "Celebrate!", notify: "Let's celebrate! 🎉" },
  { id: "angry", emoji: "😠", label: "Grr", notify: "Your plant is feeling grumpy 😠" },
] as const;

export type Emotion = (typeof EMOTIONS)[number]["id"];

export const emotionInfo = (id: string | null | undefined) => EMOTIONS.find((e) => e.id === id) ?? null;
