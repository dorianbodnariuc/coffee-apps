import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";

import { useTheme } from "@/hooks/use-theme";
import { useSavedTermIds, useToggleSaveTerm } from "@/hooks/use-saved-terms";
import { useAuth } from "@/lib/auth-context";
import type { GlossaryTerm } from "@/lib/glossary-match";

/**
 * Term modal (T7/T11): full definition + category + related terms, with a
 * save/unsave bookmark (T17). Rendered over the dictionary or a brew detail.
 *
 * T17: tapping save while signed out routes to /auth carrying the term slug;
 * after sign-in the dictionary reopens this term (return-to-term contract).
 * The term is NOT auto-saved — the user confirms with one tap.
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
  const router = useRouter();
  const { user, loading } = useAuth();
  const savedIds = useSavedTermIds();
  const toggleSave = useToggleSaveTerm();

  const saved = term ? !!user && !!savedIds.data?.has(term.id) : false;
  const busy = loading || toggleSave.isPending;

  const handleSave = () => {
    if (!term || busy) return;
    if (!user) {
      // Signed out: close the modal (a native Modal would cover /auth), then
      // route to auth carrying the slug so we can return to this term.
      onClose();
      router.push({ pathname: "/auth", params: { term: term.slug } });
      return;
    }
    toggleSave.mutate({ termId: term.id, saved });
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={term != null}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <Pressable
          style={[styles.card, { backgroundColor: theme.background }]}
          onPress={() => {}}
        >
          {term ? (
            <>
              <View style={styles.headerRow}>
                <Text
                  style={[styles.title, { color: theme.text }]}
                  numberOfLines={2}
                >
                  {term.term}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={saved ? "Remove from saved" : "Save term"}
                  disabled={busy}
                  onPress={handleSave}
                  style={({ pressed }) => [
                    styles.saveChip,
                    {
                      backgroundColor: saved
                        ? theme.backgroundSelected
                        : theme.backgroundElement,
                    },
                    pressed && styles.pressed,
                    busy && styles.busy,
                  ]}
                >
                  <Text
                    style={[styles.saveText, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {saved ? "★ Saved" : "☆ Save"}
                  </Text>
                </Pressable>
              </View>
              {term.categories.length > 0 ? (
                <View style={styles.categoryWrap}>
                  {term.categories.map((cat) => (
                    <Pressable
                      accessibilityRole="button"
                      key={cat}
                      onPress={() => onSelectCategory?.(cat)}
                      style={({ pressed }) => [
                        styles.categoryChip,
                        { backgroundColor: theme.backgroundElement },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {cat}
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
                  ))}
                </View>
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
      </View>
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
    alignSelf: "center",
    borderRadius: 14,
    maxHeight: "70%",
    maxWidth: 480,
    padding: 20,
    width: "100%",
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
  },
  saveChip: {
    alignItems: "center",
    borderRadius: 18,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 14,
  },
  saveText: {
    fontSize: 13,
    fontWeight: "600",
  },
  categoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  categoryChip: {
    alignItems: "center",
    borderRadius: 18,
    flexDirection: "row",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "600",
  },
  categoryChevron: {
    fontSize: 15,
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
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  busy: {
    opacity: 0.5,
  },
});
