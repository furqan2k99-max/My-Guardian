import { Platform } from 'react-native';

/**
 * Shared design tokens for MyGuardian. The accent color matches the elder
 * app's `Accent = #1D4ED8` (deep indigo) so both apps read as one product.
 *
 * Glassmorphism is reserved for content cards on the guardian app; the rest
 * of the UI stays on solid, high-contrast surfaces.
 */
export const colors = {
  // Brand
  accent: '#1D4ED8',
  accentPressed: '#1E40AF',
  accentSoft: '#DBEAFE',
  accentInk: '#1E3A8A',

  // Surfaces (solid base layer that glass sits on)
  background: '#F4F6FB',
  backgroundTop: '#EAF0FB',
  surface: '#FFFFFF',
  surfaceMuted: '#F3F4F6',
  surfaceMuted2: '#E5E7EB',

  // Ink
  text: '#0F172A',
  textMuted: '#475569',
  textSubtle: '#64748B',

  // Borders / dividers
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',

  // Risk palette (semantic, used across both apps)
  high: '#B91C1C',
  highSoft: '#FEE2E2',
  medium: '#B45309',
  mediumSoft: '#FEF3C7',
  low: '#15803D',
  lowSoft: '#DCFCE7',

  // Misc
  danger: '#B91C1C',
  onAccent: '#FFFFFF',
  scrim: 'rgba(15, 23, 42, 0.04)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const type = {
  // Family choices: keep native system sans on each platform for a real
  // industry feel; SF Pro on iOS, Roboto on Android, system-ui on web.
  family: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  familyMedium: Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'System' }),
  familyMono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),

  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' as const, letterSpacing: -0.4 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.2 },
  subtitle: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const, letterSpacing: 0.6 },
};

/**
 * Risk level helper. Returns consistent colors and a short label that can be
 * used by RiskBadge. Single source of truth for the high/medium/low cutoff.
 */
export type RiskTier = 'high' | 'medium' | 'low' | 'unknown';

export function riskTier(score: number | null | undefined): RiskTier {
  if (score === null || score === undefined) return 'unknown';
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

export const riskPalette: Record<RiskTier, { fg: string; bg: string; label: string }> = {
  high: { fg: colors.high, bg: colors.highSoft, label: 'High' },
  medium: { fg: colors.medium, bg: colors.mediumSoft, label: 'Medium' },
  low: { fg: colors.low, bg: colors.lowSoft, label: 'Low' },
  unknown: { fg: colors.textMuted, bg: colors.surfaceMuted, label: 'Unknown' },
};

export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  glass: {
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
};
