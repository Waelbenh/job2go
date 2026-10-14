// Score colors from DESIGN.md: 8-10 green, 7 blue, 5-6 amber, below 5 red, 0 = not scored
export function scoreColor(score: number): string {
  if (!score) return 'var(--color-ink-faint)'
  if (score >= 8) return 'var(--color-score-great)'
  if (score === 7) return 'var(--color-score-good)'
  if (score >= 5) return 'var(--color-score-maybe)'
  return 'var(--color-score-low)'
}
