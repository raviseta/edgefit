import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { radius, spacing, typography, useTheme } from '../theme';

export function RowGroup({ children, footer }: { children: ReactNode; footer?: string }) {
  const { colors } = useTheme();
  return (
    <View>
      <View style={[styles.group, { backgroundColor: colors.surface }]}>{children}</View>
      {footer ? <Text style={[typography.caption, styles.footer, { color: colors.textMuted }]}>{footer}</Text> : null}
    </View>
  );
}

export function Row({
  label,
  value,
  onPress,
  destructive,
  first,
  accessory,
  testID,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  first?: boolean;
  accessory?: ReactNode;
  testID?: string;
}) {
  const { colors } = useTheme();
  const content = (
    <View style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
      <Text style={[typography.body, styles.label, { color: destructive ? colors.danger : colors.text }]}>{label}</Text>
      {value ? <Text style={[typography.body, { color: colors.textMuted }]}>{value}</Text> : null}
      {accessory}
      {onPress && !destructive ? <Text style={[typography.headline, { color: colors.textMuted }]}>›</Text> : null}
    </View>
  );
  if (!onPress) {
    return (
      <View testID={testID} accessible={!accessory} accessibilityLabel={value ? `${label}: ${value}` : label}>
        {content}
      </View>
    );
  }
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {content}
    </Pressable>
  );
}

export function SwitchRow({
  label,
  value,
  onValueChange,
  disabled,
  first,
  testID,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  first?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Row
      label={label}
      first={first}
      accessory={
        <Switch
          testID={testID}
          accessibilityLabel={label}
          value={value}
          disabled={disabled}
          onValueChange={onValueChange}
          trackColor={{ true: colors.accent }}
        />
      }
    />
  );
}

export function SegmentedRow<T extends string>({
  label,
  options,
  value,
  onChange,
  first,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  first?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Row
      label={label}
      first={first}
      accessory={
        <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segmented, { backgroundColor: colors.surfaceMuted }]}>
          {options.map((option) => {
            const selected = option === value;
            return (
              <Pressable
                key={option}
                testID={`segment-${option}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => onChange(option)}
                style={[styles.segment, selected && { backgroundColor: colors.surface }]}
              >
                <Text style={[typography.caption, { color: colors.text, fontWeight: selected ? '600' : '400' }]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: radius.md, paddingHorizontal: spacing.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingVertical: spacing.sm, gap: spacing.sm },
  label: { flex: 1 },
  footer: { marginTop: spacing.xs, marginHorizontal: spacing.lg },
  segmented: { flexDirection: 'row', borderRadius: 8, padding: 2 },
  segment: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 6 },
});
