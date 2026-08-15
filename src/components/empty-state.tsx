import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { Radius } from "@/constants/theme";

export type EmptyStateProps = {
  /** Ionicons glyph name (outline variants read best at this size). */
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Designed empty/signed-out/error state: icon + copy + optional primary
 * action. Used on history, dictionary, settings, auth, and brew detail.
 */
export default function EmptyState({
  icon = "cafe-outline",
  title,
  body,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={40} color={theme.textSecondary} />
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {body ? (
        <Text style={[styles.body, { color: theme.textSecondary }]}>{body}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 32,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  button: {
    alignItems: "center",
    borderRadius: Radius.md,
    justifyContent: "center",
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.7,
  },
});
