import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SCORE_LEVEL_BANDS, type CalendarDay, type ScoreLevel } from '@/domain/calendar';
import { fromDateKey } from '@/domain/dates';
import { EMPTY_VALUE } from '@/lib/format';
import { fonts, radius, spacing, typography, useTheme, type ThemeColors } from '../theme';

/** The MVP UI is English-only (see lib/format), so weeks start on Sunday as in en-US. */
const LOCALE = 'en-US';
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const COLUMN = `${100 / 7}%` as const;

/**
 * Fill opacity per score band, as a hex alpha on the accent colour. Text on
 * bands 1–3 uses the regular text colour; band 4 is solid accent with onAccent
 * text. Both pairs stay above 4.5:1 in light and dark mode.
 */
const BAND_ALPHA: Record<1 | 2 | 3, string> = { 1: '26', 2: '59', 3: '8C' };

export function cellColors(level: ScoreLevel, colors: ThemeColors) {
  switch (level) {
    case 'unknown':
      return { background: 'transparent', border: colors.chartEmpty, borderStyle: 'dashed' as const, text: colors.textMuted };
    case 'zero':
      return { background: colors.surfaceMuted, border: colors.chartEmpty, borderStyle: 'solid' as const, text: colors.text };
    case 4:
      return { background: colors.accent, border: colors.accent, borderStyle: 'solid' as const, text: colors.onAccent };
    default:
      return {
        background: `${colors.accent}${BAND_ALPHA[level]}`,
        border: 'transparent',
        borderStyle: 'solid' as const,
        text: colors.text,
      };
  }
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

/**
 * 30-day heatmap laid out as weeks (Sunday first). Each cell shows the day of
 * the month and its score, or a dash when the score is unknown, so meaning is
 * never carried by colour alone: unknown days also get a dashed outline, a
 * valid zero shows "0" on a neutral tile, and today carries a dot marker.
 */
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
  const leading = days.length > 0 ? fromDateKey(days[0]!.date).getDay() : 0;
  const cells: (CalendarDay | null)[] = [...Array.from({ length: leading }, () => null), ...days];

  return (
    <View testID="calendar-grid">
      <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={[typography.caption, styles.weekday, { color: colors.textMuted }]}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.row}>
        {cells.map((day, i) =>
          day ? (
            <CalendarCell
              key={day.date}
              day={day}
              showMonth={i === leading || day.date.endsWith('-01')}
              selected={day.date === selectedDate}
              onPress={() => onSelect(day.date)}
            />
          ) : (
            <View key={`pad-${i}`} style={styles.cellSlot} />
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
  const { colors } = useTheme();
  const c = cellColors(day.level, colors);
  const date = fromDateKey(day.date);
  const dayLabel = showMonth
    ? `${date.toLocaleDateString(LOCALE, { month: 'short' })} ${date.getDate()}`
    : String(date.getDate());

  return (
    <View style={styles.cellSlot}>
      <Pressable
        testID={`calendar-day-${day.date}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={dayAccessibilityLabel(day)}
        onPress={onPress}
        style={[
          styles.cell,
          { backgroundColor: c.background, borderColor: c.border, borderStyle: c.borderStyle },
          selected && { borderColor: colors.text, borderStyle: 'solid', borderWidth: 2 },
        ]}
      >
        <Text
          maxFontSizeMultiplier={1.2}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.cellDate, { color: c.text, fontFamily: day.isToday ? fonts.bodyBold : fonts.body }]}
        >
          {dayLabel}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={[styles.cellScore, { color: c.text }]}>
          {day.score === null ? EMPTY_VALUE : day.score}
        </Text>
        {day.isToday ? <View testID="calendar-today-marker" style={[styles.todayDot, { backgroundColor: c.text }]} /> : null}
      </Pressable>
    </View>
  );
}

/** Legend for the heatmap: unknown, zero, the four score bands, today and the selection ring. */
export function ActivityCalendarLegend() {
  const { colors } = useTheme();
  const swatch = (level: ScoreLevel) => {
    const c = cellColors(level, colors);
    return [styles.swatch, { backgroundColor: c.background, borderColor: c.border, borderStyle: c.borderStyle }];
  };
  const item = (key: string, visual: React.ReactNode, label: string) => (
    <View key={key} style={styles.legendItem}>
      {visual}
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );

  return (
    <View testID="calendar-legend" style={styles.legend}>
      {item('unknown', <View style={swatch('unknown')} />, 'No score (no data)')}
      {item('zero', <View style={swatch('zero')} />, 'Score 0')}
      {SCORE_LEVEL_BANDS.map((b) => item(`band-${b.level}`, <View style={swatch(b.level)} />, b.label))}
      {item('today', <View style={[styles.legendDot, { backgroundColor: colors.text }]} />, 'Today (in progress)')}
      {item('selected', <View style={[styles.swatch, { borderColor: colors.text, borderWidth: 2 }]} />, 'Selected')}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: COLUMN, textAlign: 'center', marginBottom: spacing.xs },
  cellSlot: { width: COLUMN, aspectRatio: 1, padding: 2 },
  cell: {
    flex: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 1,
  },
  cellDate: { fontSize: 10, lineHeight: 13 },
  cellScore: { fontFamily: fonts.display, fontSize: 13, lineHeight: 16, fontVariant: ['tabular-nums'] },
  todayDot: { position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs, marginTop: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 14, height: 14, borderRadius: 4, borderWidth: 1 },
  legendDot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 4 },
});
