import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { radius } from '../theme';

/** Feather-style 24×24 stroke icons, drawn with react-native-svg so no icon font is needed. */
const ICONS = {
  chevron: ['M9 18l6-6-6-6'],
  check: ['M20 6L9 17l-5-5'],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16v-4', 'M12 8h.01'],
  alert: [
    'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
  pulse: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  steps: ['M23 6l-9.5 9.5-5-5L1 18', 'M17 6h6v6'],
  energy: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  dumbbell: ['M6 8v8', 'M18 8v8', 'M3 10v4', 'M21 10v4', 'M6 12h12'],
  bike: [
    'M9.5 17a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z',
    'M21.5 17a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z',
    'M6 17l4-8h5l3 8',
    'M10 9L8 6H6',
  ],
  bulb: [
    'M9 18h6',
    'M10 21h4',
    'M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z',
  ],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  lock: ['M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  heart: [
    'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  ],
  chart: ['M12 20V10', 'M18 20V4', 'M6 20v-4'],
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color, strokeWidth = 2 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no">
      {ICONS[name].map((d) => (
        <Path key={d} d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

/** Rounded tile holding an icon, tinted with the metric's color. */
export function IconChip({
  name,
  color,
  background,
  size = 36,
}: {
  name: IconName;
  color: string;
  background: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={name} size={Math.round(size * 0.55)} color={color} />
    </View>
  );
}

/** Circular progress. `progress` is 0–1. Children are centered inside the ring. */
export function ProgressRing({
  progress,
  size = 132,
  strokeWidth = 12,
  color,
  trackColor,
  children,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor: string;
  children?: React.ReactNode;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * clamped} ${c}`}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Absolutely-positioned diagonal gradient; place as the first child of a `overflow: hidden` container. */
export function GradientBackground({ from, to, id = 'g' }: { from: string; to: string; id?: string }) {
  return (
    <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" rx={radius.xl} fill={`url(#${id})`} />
    </Svg>
  );
}
