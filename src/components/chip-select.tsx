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
 * Single-select chip row, used for brew method and rating in the log form
 * (and later for filters). Values come from src/constants — no magic strings.
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
            style={[
              styles.chip,
              {
                backgroundColor: selected
                  ? theme.backgroundSelected
                  : theme.backgroundElement,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color: selected ? theme.text : theme.textSecondary,
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
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
  },
});
