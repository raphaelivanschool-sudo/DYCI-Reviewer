// METAKNOWIA design tokens (same values as the HTML GUI v3 "App design system").
export const C = {
  primary: '#2563EB',
  primary700: '#1D4ED8',
  primary50: '#EFF6FF',
  primary100: '#DBEAFE',
  navy: '#1E3A8A',
  ink: '#0F172A',
  ink2: '#334155',
  muted: '#64748B',
  faint: '#94A3B8',
  line: '#E2E8F0',
  bg: '#F5F7FB',
  surface: '#FFFFFF',
  chip: '#EEF2F7',
  success: '#16A34A',
  success700: '#15803D',
  success50: '#DCFCE7',
  warning: '#F59E0B',
  amber50: '#FEF3C7',
  amber800: '#92400E',
  danger: '#DC2626',
  danger50: '#FEE2E2',
};

export const F = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
};

export const shadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.07,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

/** Subject colors used by the schedule grid and legend. */
export const SUBJECT_COLORS = ['#6D28D9', '#15803D', '#C2410C', '#1D4ED8', '#BE185D', '#A16207', '#0E7490', '#334155'];

/**
 * Colors students can pick for subjects, classes and exams.
 * All are dark enough for white text on top.
 */
export const PALETTE = [
  '#1D4ED8', '#2563EB', '#0E7490', '#0F766E', '#15803D', '#4D7C0F',
  '#A16207', '#B45309', '#C2410C', '#B91C1C', '#BE185D', '#A21CAF',
  '#7E22CE', '#6D28D9', '#4338CA', '#334155',
];

/** Folder tile tints. Older subjects saved one of these names; newer ones save a hex color. */
export const TINTS: Record<string, { bg: string; fg: string }> = {
  green: { bg: '#DCFCE7', fg: '#15803D' },
  purple: { bg: '#F3E8FF', fg: '#7E22CE' },
  teal: { bg: '#CCFBF1', fg: '#0F766E' },
  blue: { bg: '#DBEAFE', fg: '#1D4ED8' },
  amber: { bg: '#FEF3C7', fg: '#B45309' },
  red: { bg: '#FEE2E2', fg: '#B91C1C' },
};

/** Mixes a hex color with white. amount 0 = the color, 1 = white. */
function lighten(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const [r, g, b] = [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)];
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** A subject's colors from its saved tint (a tint name or a hex color). */
export function tintOf(tint?: string | null): { bg: string; fg: string } {
  if (tint && TINTS[tint]) return TINTS[tint];
  if (tint && /^#[0-9a-f]{6}$/i.test(tint)) return { bg: lighten(tint, 0.85), fg: tint };
  return TINTS.blue;
}
