import { useColorScheme } from 'react-native';

/**
 * Design tokens, following the 20deg design system ("Luminous Restraint"): deep
 * ink surfaces with hairline rims, jewel-tone accents, Montserrat for display
 * and numerals, Poppins for text. Text/background pairs meet WCAG AA in both
 * schemes (checked by `scripts/check-contrast.mjs`).
 */
const light = {
  background: '#F6F4F0',
  surface: '#FFFFFF',
  surfaceMuted: '#ECE8E1',
  text: '#17181C',
  textMuted: '#5F636E',
  border: 'rgba(23,24,28,0.10)',
  rim: 'rgba(23,24,28,0.08)',
  specular: 'rgba(255,255,255,0.95)',
  accent: '#077A6E',
  accentSoft: 'rgba(7,122,110,0.11)',
  accentMuted: 'rgba(7,122,110,0.11)',
  onAccent: '#FFFFFF',
  warning: '#8A5F00',
  warningMuted: 'rgba(184,134,11,0.14)',
  danger: '#B3203A',
  chartBar: '#077A6E',
  chartBarToday: '#077A6E',
  chartEmpty: '#CFCBC3',
  heroStart: '#0C8478',
  heroEnd: '#0A4A5C',
  heroRing: '#FFFFFF',
  onHero: '#FFFFFF',
  metricSteps: '#077A6E',
  metricStepsSoft: 'rgba(7,122,110,0.12)',
  metricEnergy: '#B94814',
  metricEnergySoft: 'rgba(185,72,20,0.12)',
  metricTime: '#5236C4',
  metricTimeSoft: 'rgba(82,54,196,0.12)',
  metricWorkouts: '#A8206F',
  metricWorkoutsSoft: 'rgba(168,32,111,0.12)',
  shadow: '#2A2418',
};

export type ThemeColors = typeof light;

const dark: ThemeColors = {
  background: '#0B0F1A',
  surface: '#151B2D',
  surfaceMuted: '#202845',
  text: '#E8ECF5',
  textMuted: '#9AA4B8',
  border: 'rgba(255,255,255,0.09)',
  rim: 'rgba(255,255,255,0.08)',
  specular: 'rgba(255,255,255,0.14)',
  accent: '#4FD8C4',
  accentSoft: 'rgba(79,216,196,0.14)',
  accentMuted: 'rgba(79,216,196,0.14)',
  onAccent: '#04201C',
  warning: '#F2C14E',
  warningMuted: 'rgba(242,193,78,0.14)',
  danger: '#F0627A',
  chartBar: '#4FD8C4',
  chartBarToday: '#4FD8C4',
  chartEmpty: '#3A4258',
  heroStart: '#173B52',
  heroEnd: '#0E1730',
  heroRing: '#4FD8C4',
  onHero: '#E8ECF5',
  metricSteps: '#4FD8C4',
  metricStepsSoft: 'rgba(79,216,196,0.16)',
  metricEnergy: '#FF9F6B',
  metricEnergySoft: 'rgba(255,159,107,0.16)',
  metricTime: '#A99BFF',
  metricTimeSoft: 'rgba(169,155,255,0.16)',
  metricWorkouts: '#F58AC4',
  metricWorkoutsSoft: 'rgba(245,138,196,0.16)',
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
