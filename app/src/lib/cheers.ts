// Little notes shown by the info icon next to this week's contribution count.
// Each applies from `min` contributions up to the next one's `min`.

export const CHEERS = [
  { min: 1, text: "wow a great start..." },
  { min: 50, text: "yayyy so smart so normal" },
  { min: 100, text: "wow so productive so locked in" },
  { min: 201, text: "200+? chill out dawg" },
  { min: 301, text: "300+? touch grass expeditiously!" },
  { min: 401, text: "400+? your girlfriend is mad at you and you should go save your relationship" },
  { min: 501, text: "500+? bro why are u still here" },
  { min: 601, text: "600+? are you commit hacking? be honest." },
] as const;

/** The note for this week's count, or null below the first threshold. */
export function cheerFor(count: number): string | null {
  return [...CHEERS].reverse().find((c) => count >= c.min)?.text ?? null;
}
