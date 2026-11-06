// Keep in sync with the `mood` check in supabase/migrations and app/src/lib/emotions.ts.
export const EMOTIONS = [
  { id: 'love', emoji: '💗', label: 'Sending love' },
  { id: 'proud', emoji: '🌟', label: 'Proud of you' },
  { id: 'luck', emoji: '🍀', label: 'Good luck' },
  { id: 'break', emoji: '☕', label: 'Take a break' },
  { id: 'celebrate', emoji: '🎉', label: 'Celebrate!' },
  { id: 'angry', emoji: '😠', label: 'Grr' },
] as const

export type Emotion = (typeof EMOTIONS)[number]['id']

export const emotionInfo = (id: string | null) => EMOTIONS.find((e) => e.id === id) ?? null
