import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type AutocompleteOption = {
  id: string;
  label: string;
  sublabel?: string;
};

export type AutocompleteInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  /** Full suggestion pool, filtered client-side as the user types. */
  options: AutocompleteOption[];
  /** Selecting a suggestion fills the field + lets the parent link an FK. */
  onSelect: (option: AutocompleteOption) => void;
  /** When true and the typed text has no exact match, show an "Add 'X'" row. */
  allowCreate?: boolean;
  onCreate?: (text: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
  autoFocus?: boolean;
};

const MAX_SUGGESTIONS = 6;

/**
 * Type-ahead input (D-033). Shows matching rows while typing and, when
 * `allowCreate`, an "Add 'X'" row that creates a name-only catalog entry via
 * the parent's `onCreate`. Free text is always accepted — the field is not
 * constrained to the suggestion list.
 */
export default function AutocompleteInput({
  value,
  onChangeText,
  options,
  onSelect,
  allowCreate = false,
  onCreate,
  placeholder,
  accessibilityLabel,
  autoFocus = false,
}: AutocompleteInputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const needle = value.trim().toLowerCase();
  const matches = needle
    ? options
        .filter((o) => o.label.toLowerCase().includes(needle))
        .slice(0, MAX_SUGGESTIONS)
    : [];
  const hasExact = needle
    ? options.some((o) => o.label.toLowerCase() === needle)
    : false;
  const canCreate =
    allowCreate && !!onCreate && needle.length > 0 && !hasExact;
  const open = focused && (matches.length > 0 || canCreate);

  const close = () => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    setFocused(false);
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text },
  ];

  return (
    <View>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        autoFocus={autoFocus}
        onChangeText={onChangeText}
        onBlur={() => {
          // Delay close so a tap on a suggestion (onPress) fires before the
          // dropdown unmounts — a bare onBlur hides the row mid-gesture.
          blurTimer.current = setTimeout(() => setFocused(false), 150);
        }}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        style={inputStyle}
        value={value}
      />
      {open ? (
        <View
          style={[
            styles.dropdown,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
        >
          {matches.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option.id}
              onPress={() => {
                onSelect(option);
                close();
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text
                style={[styles.rowLabel, { color: theme.text }]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
              {option.sublabel ? (
                <Text
                  style={[styles.rowSub, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {option.sublabel}
                </Text>
              ) : null}
            </Pressable>
          ))}
          {canCreate ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onCreate?.(value.trim());
                close();
              }}
              style={({ pressed }) => [
                styles.row,
                styles.addRow,
                { borderTopColor: theme.border },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="add-circle-outline"
                size={18}
                color={theme.primary}
              />
              <Text
                style={[styles.addLabel, { color: theme.primary }]}
                numberOfLines={1}
              >
                {`Add "${value.trim()}"`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: Radius.md,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdown: {
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: 4,
    overflow: "hidden",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  rowSub: {
    fontSize: 13,
    maxWidth: "45%",
  },
  addRow: {
    borderTopWidth: 1,
    justifyContent: "flex-start",
  },
  addLabel: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.7,
  },
});
