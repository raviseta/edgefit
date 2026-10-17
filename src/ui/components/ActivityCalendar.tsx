import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CalendarDay, ScoreLevel } from '@/domain/calendar';
import { fromDateKey } from '@/domain/dates';
import { fonts, radius, spacing, typography, useTheme, type ThemeColors } from '../theme';

/** The MVP UI is English-only (see lib/format). Weeks run Monday to Sunday. */
const LOCALE = 'en-US';
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const GAP = 6;
/** Just under 1/7: exact sevenths can round past the row width and wrap the 7th column. */
const COLUMN = '14.28%';

/**
 * Five-step score scale: a neutral tile for a valid 0, then four accent bands.
 * Unknown days are never on this scale: they are a dashed outline with no fill.
 * Day numbers on every step stay at or above 4.5:1 contrast in both themes.
 */
const SCALE_ALPHA = { light: ['1F', '4D', '94'], dark: ['2E', '5C', 'B0'] } as const;

export function cellColors(level: ScoreLevel, colors: ThemeColors, isDark: boolean) {
  switch (level) {
    case 'unknown':
      return { background: 'transparent', border: colors.chartEmpty, borderStyle: 'dashed' as const, text: colors.textMuted };
    case 'zero':
      return { background: colors.surfaceMuted, border: 'transparent', borderStyle: 'solid' as const, text: colors.text };
    case 4:
      return { background: colors.accent, border: 'transparent', borderStyle: 'solid' as const, text: colors.onAccent };
    default: {
      const alpha = SCALE_ALPHA[isDark ? 'dark' : 'light'][level - 1]!;
      const text = isDark && level === 3 ? colors.onAccent : colors.text;
      return { background: `${colors.accent}${alpha}`, border: 'transparent', borderStyle: 'solid' as const, text };
    }
  }
}

/** The legend's 0 → 100 strip, in scale order. */
export function scaleSwatches(colors: ThemeColors, isDark: boolean): string[] {
  return (['zero', 1, 2, 3, 4] as const).map((level) => cellColors(level, colors, isDark).background);
}

export function longDateLabel(date: string): string {
  return fromDateKey(date).toLocaleDateString(LOCALE, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function dayAccessibilityLabel(day: CalendarDay): string {
  const parts = [longDateLabel(day.date)];
  if (day.isToday) parts.push('today, still in progress');
  parts.push(day.score === null ? 'no score, data unavailable' : `Activity Score ${day.score}`);
  if (day.workouts.length > 0) parts.push(`${day.workouts.length} workout${day.workouts.length === 1 ? '' : 's'}`);
  return parts.join(', ');
}

/** Monday-first month grid: leading blanks before the first day, trailing blanks to fill the last week. */
export function toMonthGrid(days: CalendarDay[]): (CalendarDay | null)[] {
  if (days.length === 0) return [];
  const leading = (fromDateKey(days[0]!.date).getDay() + 6) % 7; // Monday = 0
  const cells: (CalendarDay | null)[] = [...Array.from({ length: leading }, () => null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function ActivityCalendarGrid({
  days,
  selectedDate,
  onSelect,
}: {
  days: CalendarDay[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const { colors } = useTheme();
  const cells = toMonthGrid(days);
  const firstDate = days[0]?.date;

  return (
    <View testID="calendar-grid">
      <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={[styles.weekday, { color: colors.textMuted }]}>
            {d}
          </Text>
        ))}
      </View>
      <View style={[styles.row, styles.cells]}>
        {cells.map((day, i) =>
          day ? (
            <CalendarCell
              key={day.date}
              day={day}
              showMonth={day.date === firstDate || day.date.endsWith('-01')}
              selected={day.date === selectedDate}
              onPress={() => onSelect(day.date)}
            />
          ) : (
            <View key={`pad-${i}`} style={styles.slot}>
              <View style={styles.blank} />
            </View>
          ),
        )}
      </View>
    </View>
  );
}

function CalendarCell({
  day,
  showMonth,
  selected,
  onPress,
}: {
  day: CalendarDay;
  showMonth: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, isDark } = useTheme();
  const c = cellColors(day.level, colors, isDark);
  const date = fromDateKey(day.date);

  return (
    <View style={styles.slot}>
      {selected ? (
        <View testID="calendar-selected-ring" pointerEvents="none" style={[styles.ring, { borderColor: colors.text }]} />
      ) : null}
      <Pressable
        testID={`calendar-day-${day.date}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={dayAccessibilityLabel(day)}
        onPress={onPress}
        style={[styles.cell, { backgroundColor: c.background, borderColor: c.border, borderStyle: c.borderStyle }]}
      >
        <Text maxFontSizeMultiplier={1.1} style={[styles.month, { color: c.text }]}>
          {showMonth ? date.toLocaleDateString(LOCALE, { month: 'short' }) : ''}
        </Text>
        <Text
          maxFontSizeMultiplier={1.2}
          style={[styles.number, { color: c.text, fontFamily: day.isToday ? fonts.bodyBold : fonts.bodyMedium }]}
        >
          {date.getDate()}
        </Text>
        <View
          testID={day.isToday ? 'calendar-today-marker' : undefined}
          style={[styles.dot, { backgroundColor: day.isToday ? c.text : 'transparent' }]}
        />
      </Pressable>
    </View>
  );
}

/** "No data" outline, the 0 → 100 score strip, and the today marker. */
export function ActivityCalendarLegend() {
  const { colors, isDark } = useTheme();
  return (
    <View testID="calendar-legend" style={[styles.legend, { borderTopColor: colors.border }]}>
      <View style={styles.legendItem} accessible accessibilityLabel="Outlined: no data">
        <View style={[styles.swatch, styles.swatchEmpty, { borderColor: colors.chartEmpty }]} />
        <Text style={[styles.legendText, { color: colors.textMuted }]}>No data</Text>
      </View>
      <View
        style={styles.legendScale}
        accessible
        accessibilityLabel="Fill shows the Activity Score, from 0 (lightest) to 100 (darkest)"
      >
        <Text style={[styles.legendText, { color: colors.textMuted }]}>0</Text>
        {scaleSwatches(colors, isDark).map((bg) => (
          <View key={bg} style={[styles.swatch, { backgroundColor: bg }]} />
        ))}
        <Text style={[styles.legendText, { color: colors.textMuted }]}>100</Text>
      </View>
      <View style={styles.legendItem} accessible accessibilityLabel="Dot: today">
        <View style={[styles.legendDot, { backgroundColor: colors.text }]} />
        <Text style={[styles.legendText, { color: colors.textMuted }]}>Today</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -GAP / 2 },
  cells: { rowGap: GAP },
  weekday: { ...typography.overline, width: COLUMN, textAlign: 'center', marginBottom: spacing.sm, letterSpacing: 0 },
  slot: { width: COLUMN, paddingHorizontal: GAP / 2 },
  blank: { aspectRatio: 1 },
  ring: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    left: GAP / 2 - 4,
    right: GAP / 2 - 4,
    borderRadius: radius.md + 2,
    borderWidth: 2,
  },
  cell: { aspectRatio: 1, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 1 },
  month: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    lineHeight: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  number: { fontSize: 14, lineHeight: 18, fontVariant: ['tabular-nums'] },
  dot: { width: 4, height: 4, borderRadius: 2 },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendScale: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  swatchEmpty: { borderWidth: 1.5, borderStyle: 'dashed' },
  legendDot: { width: 4, height: 4, borderRadius: 2 },
});
