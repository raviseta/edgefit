import { useColorScheme } from 'react-native';

/** Color tokens. Text/background pairs meet WCAG AA contrast in both schemes. */
const light = {
  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceMuted: '#E9E9EF',
  text: '#111114',
  textMuted: '#5C5C66',
  border: '#D8D8DE',
  accent: '#0A7A5A',
  accentMuted: '#D6F0E7',
  onAccent: '#FFFFFF',
  warning: '#8A5A00',
  warningMuted: '#FFF1D6',
  danger: '#B3261E',
  chartBar: '#0A7A5A',
  chartBarToday: '#065E45',
  chartEmpty: '#C9C9D1',
};

export type ThemeColors = typeof light;

const dark: ThemeColors = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceMuted: '#2C2C2E',
  text: '#F5F5F7',
  textMuted: '#A1A1AA',
  border: '#38383A',
  accent: '#3DD6A3',
  accentMuted: '#123B2F',
  onAccent: '#00261A',
  warning: '#FFC75F',
  warningMuted: '#3A2C10',
  danger: '#FF8A80',
  chartBar: '#3DD6A3',
  chartBarToday: '#8FF0CC',
  chartEmpty: '#48484A',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { md: 12, lg: 16, pill: 999 } as const;

export const typography = {
  largeNumber: { fontSize: 34, fontWeight: '700' as const, fontVariant: ['tabular-nums' as const] },
  metric: { fontSize: 26, fontWeight: '700' as const, fontVariant: ['tabular-nums' as const] },
  title: { fontSize: 20, fontWeight: '600' as const },
  headline: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 21 },
  caption: { fontSize: 13, lineHeight: 18 },
  overline: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
};

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { colors: isDark ? dark : light, isDark };
}
