import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";

import { useTheme } from "@/hooks/use-theme";
import type { GlossaryTerm } from "@/lib/glossary-match";

/**
 * Term modal (T7): full definition + category + related terms.
 * Rendered over the brew detail screen when a matched chip is tapped.
 *
 * T11: related terms render as links when `onSelectTerm` is provided —
 * tapping one switches the modal to that term (the parent owns the lookup).
 */
export default function TermModal({
  term,
  onClose,
  onSelectTerm,
  onSelectCategory,
}: {
  term: GlossaryTerm | null;
  onClose: () => void;
  onSelectTerm?: (termName: string) => void;
  onSelectCategory?: (category: string) => void;
}) {
  const theme = useTheme();

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={term != null}
    >
      <Pressable
        accessibilityRole="button"
        style={styles.backdrop}
        onPress={onClose}
      >
        <Pressable
          style={[styles.card, { backgroundColor: theme.background }]}
          onPress={() => {}}
        >
          {term ? (
            <>
              <Text style={[styles.title, { color: theme.text }]}>
                {term.term}
              </Text>
              {term.category ? (
                onSelectCategory ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onSelectCategory(term.category!)}
                    style={({ pressed }) => [
                      styles.categoryRow,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[styles.category, { color: theme.textSecondary }]}
                    >
                      {term.category}
                    </Text>
                    <Text
                      style={[
                        styles.categoryChevron,
                        { color: theme.textSecondary },
                      ]}
                    >
                      ›
                    </Text>
                  </Pressable>
                ) : (
                  <Text
                    style={[styles.category, { color: theme.textSecondary }]}
                  >
                    {term.category}
                  </Text>
                )
              ) : null}
              <ScrollView style={styles.body}>
                <Text style={[styles.definition, { color: theme.text }]}>
                  {term.definition}
                </Text>
                {term.source_url ? (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => WebBrowser.openBrowserAsync(term.source_url)}
                    style={({ pressed }) => [
                      styles.sourceLink,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[styles.sourceLinkText, { color: theme.text }]}
                    >
                      Read the full article ↗
                    </Text>
                  </Pressable>
                ) : null}
                {term.related_terms.length > 0 ? (
                  <View style={styles.relatedBox}>
                    <Text
                      style={[
                        styles.relatedLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Related
                    </Text>
                    <View style={styles.relatedRow}>
                      {term.related_terms.map((name) => (
                        <Pressable
                          accessibilityRole="button"
                          key={name}
                          onPress={() => onSelectTerm?.(name)}
                          style={({ pressed }) => [
                            styles.relatedChip,
                            { backgroundColor: theme.backgroundElement },
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.relatedChipText,
                              { color: theme.text },
                            ]}
                          >
                            {name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
              </ScrollView>
              <Pressable
                style={({ pressed }) => [
                  styles.closeButton,
                  { backgroundColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}
                onPress={onClose}
              >
                <Text style={[styles.closeText, { color: theme.text }]}>
                  Close
                </Text>
              </Pressable>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.5)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    borderRadius: 14,
    maxHeight: "70%",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  category: {
    fontSize: 12,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  categoryRow: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 4,
  },
  categoryChevron: {
    fontSize: 14,
  },
  body: {
    flexShrink: 1,
    marginTop: 12,
  },
  definition: {
    fontSize: 15,
    lineHeight: 22,
  },
  sourceLink: {
    alignSelf: "flex-start",
    marginTop: 12,
  },
  sourceLinkText: {
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  relatedBox: {
    gap: 4,
    marginTop: 16,
  },
  relatedLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  relatedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  relatedChip: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  relatedChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  closeButton: {
    alignItems: "center",
    borderRadius: 10,
    marginTop: 16,
    paddingVertical: 12,
  },
  closeText: {
    fontSize: 15,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.7,
  },
});
