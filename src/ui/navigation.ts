import { useTheme } from './theme';

/**
 * Native stack header styling shared by every tab. Standard (inline) titles:
 * large titles rendered blank on first paint on iOS 26 until the user scrolled.
 */
export function useStackScreenOptions() {
  const { colors } = useTheme();
  return {
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerTitleStyle: { color: colors.text },
    headerTintColor: colors.accent,
    contentStyle: { backgroundColor: colors.background },
  };
}
