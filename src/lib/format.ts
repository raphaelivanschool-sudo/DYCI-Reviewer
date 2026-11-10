/** plural(1, 'reviewer') → "1 reviewer", plural(3, 'reviewer') → "3 reviewers", plural(2, 'try', 'tries') → "2 tries". */
export const plural = (n: number, word: string, many?: string) => `${n} ${n === 1 ? word : many ?? `${word}s`}`;
