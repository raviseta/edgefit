import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { fonts, radius, spacing, typography, useTheme } from '../theme';
import { Icon, IconChip, type IconName } from './visuals';

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
  icon,
  testID,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  first?: boolean;
  accessory?: ReactNode;
  icon?: IconName;
  testID?: string;
}) {
  const { colors } = useTheme();
  const content = (
    <View style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
      {icon ? (
        <IconChip
          name={icon}
          size={30}
          color={destructive ? colors.danger : colors.accent}
          background={destructive ? colors.warningMuted : colors.accentSoft}
        />
      ) : null}
      <Text style={[typography.body, styles.label, { color: destructive ? colors.danger : colors.text }]}>{label}</Text>
      {value ? <Text style={[typography.body, { color: colors.textMuted }]}>{value}</Text> : null}
      {accessory}
      {onPress && !destructive ? <Icon name="chevron" size={18} color={colors.textMuted} /> : null}
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
  icon,
  testID,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  first?: boolean;
  icon?: IconName;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Row
      label={label}
      first={first}
      icon={icon}
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
  icon,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  first?: boolean;
  icon?: IconName;
}) {
  const { colors } = useTheme();
  return (
    <Row
      label={label}
      first={first}
      icon={icon}
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
                <Text style={[typography.caption, { color: selected ? colors.accent : colors.textMuted, fontFamily: selected ? fonts.bodySemibold : fonts.bodyMedium }]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: radius.lg, paddingHorizontal: spacing.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: spacing.sm, gap: spacing.md },
  label: { flex: 1 },
  footer: { marginTop: spacing.xs, marginHorizontal: spacing.lg },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segment: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.sm },
});
