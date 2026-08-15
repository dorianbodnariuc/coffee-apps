import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";

export type ChipSelectProps<T extends string | number> = {
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  /** Optional custom label (e.g. rating 1 -> "1.0"). Defaults to String(value). */
  labelFor?: (value: T) => string;
  accessibilityLabel?: string;
};

/**
 * Single-select chip row, used for brew method, rating, and filters.
 * Values come from src/constants — no magic strings. T22: 44px targets and a
 * high-contrast selected state (solid text-color fill, inverted label).
 */
export default function ChipSelect<T extends string | number>({
  options,
  value,
  onChange,
  labelFor,
  accessibilityLabel,
}: ChipSelectProps<T>) {
  const theme = useTheme();

  return (
    <View style={styles.row} accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={String(option)}
            onPress={() => onChange(option)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: selected
                  ? theme.text
                  : theme.backgroundElement,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color: selected ? theme.background : theme.textSecondary,
                  fontWeight: selected ? "600" : "400",
                },
              ]}
            >
              {labelFor ? labelFor(option) : String(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 20,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipText: {
    fontSize: 14,
  },
  pressed: {
    opacity: 0.7,
  },
});
