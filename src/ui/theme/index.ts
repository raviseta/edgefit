import { useColorScheme } from 'react-native';

/**
 * Design tokens, following the 20deg design system ("Luminous Restraint"): deep
 * ink surfaces with hairline rims, jewel-tone accents, Montserrat for display
 * and numerals, Poppins for text. Text/background pairs meet WCAG AA in both
 * schemes (checked by `scripts/check-contrast.mjs`).
 */
const light = {
  background: '#F6F6F6',
  surface: '#FFFFFF',
  surfaceMuted: '#EEEEEE',
  text: '#0E0D12',
  textMuted: '#5A5962',
  border: 'rgba(14,13,18,0.10)',
  rim: 'rgba(14,13,18,0.08)',
  specular: 'rgba(255,255,255,0.95)',
  accent: '#6100ED',
  accentSoft: 'rgba(97,0,237,0.10)',
  accentMuted: 'rgba(97,0,237,0.10)',
  onAccent: '#FFFFFF',
  warning: '#8A5F00',
  warningMuted: 'rgba(184,134,11,0.14)',
  danger: '#B3203A',
  chartBar: '#6100ED',
  chartBarToday: '#6100ED',
  chartEmpty: '#BEBEBE',
  heroStart: '#1E1C26',
  heroEnd: '#0E0D12',
  heroRing: '#FFFFFF',
  onHero: '#FFFFFF',
  metricSteps: '#6100ED',
  metricStepsSoft: '#DECCFF',
  metricEnergy: '#B0284E',
  metricEnergySoft: '#FADCE1',
  metricTime: '#00609A',
  metricTimeSoft: '#C2EAFF',
  metricWorkouts: '#3B6E00',
  metricWorkoutsSoft: '#D8F9AE',
  shadow: '#0E0D12',
};

export type ThemeColors = typeof light;

const dark: ThemeColors = {
  background: '#0E0D12',
  surface: '#1A1920',
  surfaceMuted: '#27252F',
  text: '#F4F3F8',
  textMuted: '#A6A4B0',
  border: 'rgba(255,255,255,0.09)',
  rim: 'rgba(255,255,255,0.08)',
  specular: 'rgba(255,255,255,0.14)',
  accent: '#B69BFF',
  accentSoft: 'rgba(182,155,255,0.16)',
  accentMuted: 'rgba(182,155,255,0.16)',
  onAccent: '#0E0D12',
  warning: '#F2C14E',
  warningMuted: 'rgba(242,193,78,0.14)',
  danger: '#F0627A',
  chartBar: '#B69BFF',
  chartBarToday: '#B69BFF',
  chartEmpty: '#3A3946',
  heroStart: '#262236',
  heroEnd: '#16141F',
  heroRing: '#B69BFF',
  onHero: '#F4F3F8',
  metricSteps: '#B69BFF',
  metricStepsSoft: '#332E44',
  metricEnergy: '#FF9FB4',
  metricEnergySoft: '#3F2E38',
  metricTime: '#8CD4FF',
  metricTimeSoft: '#2C3744',
  metricWorkouts: '#B7EC7C',
  metricWorkoutsSoft: '#333B2F',
  shadow: '#000000',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const radius = { sm: 8, md: 12, field: 14, button: 15, lg: 16, xl: 18, pill: 999 } as const;

/** Loaded in `src/app/_layout.tsx` via `useFonts`. Names match the @expo-google-fonts exports. */
export const fonts = {
  displayMedium: 'Montserrat_500Medium',
  display: 'Montserrat_700Bold',
  displayHeavy: 'Montserrat_800ExtraBold',
  body: 'Poppins_400Regular',
  bodyMedium: 'Poppins_500Medium',
  bodySemibold: 'Poppins_600SemiBold',
  bodyBold: 'Poppins_700Bold',
} as const;

// Custom font families encode their weight, so no `fontWeight` is set here.
export const typography = {
  hero: { fontFamily: fonts.displayHeavy, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  score: { fontFamily: fonts.displayHeavy, fontSize: 40, lineHeight: 46, fontVariant: ['tabular-nums' as const] },
  largeNumber: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, fontVariant: ['tabular-nums' as const] },
  metric: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums' as const],
  },
  title: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  headline: { fontFamily: fonts.bodySemibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  overline: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
};

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { colors: isDark ? dark : light, isDark };
}
