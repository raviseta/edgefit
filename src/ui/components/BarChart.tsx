import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { spacing, typography, useTheme } from '../theme';

export interface BarDatum {
  key: string;
  label: string;
  /** `null` = no data for that day; drawn as a dashed placeholder, never as a zero bar. */
  value: number | null;
  highlight?: boolean;
}

const HEIGHT = 168;
const LABEL_SPACE = 22;
const VALUE_SPACE = 18;

/**
 * Minimal SVG bar chart. Stays readable with missing data: gaps are drawn as
 * dashed stubs and the accessibility label lists them as "no data".
 */
export function BarChart({
  data,
  formatValue,
  referenceValue,
  referenceLabel,
  maxValue,
  title,
  testID,
}: {
  data: BarDatum[];
  formatValue: (value: number) => string;
  referenceValue?: number | null;
  referenceLabel?: string;
  maxValue?: number;
  title: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  const values = data.map((d) => d.value).filter((v): v is number => v !== null);
  const max = Math.max(maxValue ?? 0, ...values, referenceValue ?? 0, 1);
  const plotHeight = HEIGHT - LABEL_SPACE - VALUE_SPACE;
  const slot = data.length > 0 ? width / data.length : 0;
  const barWidth = Math.min(28, slot * 0.6);
  const y = (v: number) => VALUE_SPACE + plotHeight - (v / max) * plotHeight;

  const description = data
    .map((d) => `${d.label}: ${d.value === null ? 'no data' : formatValue(d.value)}`)
    .join(', ');

  return (
    <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={`${title}. ${description}`}>
      <View style={{ height: HEIGHT }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            {referenceValue ? (
              <Line
                x1={0}
                x2={width}
                y1={y(referenceValue)}
                y2={y(referenceValue)}
                stroke={colors.textMuted}
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            ) : null}
            {data.map((d, i) => {
              const cx = slot * i + slot / 2;
              const x = cx - barWidth / 2;
              const baseline = VALUE_SPACE + plotHeight;
              return (
                <G key={d.key}>
                  {d.value === null ? (
                    <Line
                      x1={x}
                      x2={x + barWidth}
                      y1={baseline - 1}
                      y2={baseline - 1}
                      stroke={colors.chartEmpty}
                      strokeWidth={2}
                      strokeDasharray="3 3"
                    />
                  ) : (
                    <Rect
                      x={x}
                      y={y(d.value)}
                      width={barWidth}
                      height={Math.max(2, baseline - y(d.value))}
                      rx={6}
                      fill={d.highlight ? colors.chartBarToday : colors.chartBar}
                    />
                  )}
                  <SvgText
                    x={cx}
                    y={HEIGHT - 6}
                    fontSize={12}
                    fontWeight={d.highlight ? '700' : '400'}
                    fill={d.highlight ? colors.text : colors.textMuted}
                    textAnchor="middle"
                  >
                    {d.label}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        ) : null}
      </View>
      {referenceValue && referenceLabel ? (
        <Text style={[typography.caption, styles.legend, { color: colors.textMuted }]}>
          - - {referenceLabel}: {formatValue(referenceValue)}
        </Text>
      ) : null}
      {values.length < data.length ? (
        <Text style={[typography.caption, styles.legend, { color: colors.textMuted }]}>
          Dashed gaps mark days with no data.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { marginTop: spacing.xs },
});
