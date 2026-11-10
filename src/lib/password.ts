/** Password rules shown as a live checklist on Sign up. All must pass. */
export const PASSWORD_RULES: { id: string; label: string; test: (p: string) => boolean }[] = [
  { id: 'len', label: '8+ characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'Uppercase (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'Lowercase (a–z)', test: (p) => /[a-z]/.test(p) },
  { id: 'num', label: 'Number (0–9)', test: (p) => /\d/.test(p) },
  { id: 'special', label: 'Special (!@#$%)', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

export function passwordCheck(p: string) {
  const results = PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(p) }));
  const passed = results.filter((r) => r.ok).length;
  const label = !p ? 'Type a password' : passed <= 2 ? 'Weak' : passed <= 4 ? 'Almost there!' : 'Strong!';
  const color = passed <= 2 ? '#DC2626' : passed <= 4 ? '#F59E0B' : '#22C55E';
  return { results, passed, ok: passed === PASSWORD_RULES.length, label, color };
}
