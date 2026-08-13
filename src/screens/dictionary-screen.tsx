import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";

import TermModal from "@/components/term-modal";
import { useGlossaryTerms } from "@/hooks/use-glossary";
import { useTheme } from "@/hooks/use-theme";
import type { GlossaryTerm } from "@/lib/glossary-match";
import { searchGlossaryTerms } from "@/lib/glossary-search";

/**
 * Dictionary tab (T11): searchable glossary of all terms (public read —
 * works signed out). Client-side filter over the cached term list; tapping a
 * row opens the term modal, and related terms inside it link to their own
 * entries. Search state survives because the list stays mounted under the
 * modal (no navigation).
 *
 * T8: category chips filter the list by the site's WP taxonomy, and the
 * category label in the term modal is tappable (sets the same filter).
 */
export default function DictionaryScreen() {
  const theme = useTheme();
  const { data, isLoading, isError, refetch } = useGlossaryTerms();
  const params = useLocalSearchParams<{ category?: string }>();
  const [query, setQuery] = useState("");
  const [activeTerm, setActiveTerm] = useState<GlossaryTerm | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(
    () => params.category ?? null,
  );
  // Arriving from another screen (e.g. a brew detail's glossary chip) with a
  // category param pre-selects that category. Render-phase adjustment (not an
  // effect) so it's lint-clean and immediate.
  const [lastParam, setLastParam] = useState(params.category);
  if (params.category !== lastParam) {
    setLastParam(params.category);
    if (params.category) setCategoryFilter(params.category);
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set).sort();
  }, [data]);

  const inCategory = useMemo(
    () =>
      categoryFilter
        ? (data ?? []).filter((t) => t.category === categoryFilter)
        : (data ?? []),
    [data, categoryFilter],
  );

  const filtered = useMemo(
    () => searchGlossaryTerms(inCategory, query),
    [inCategory, query],
  );

  const openTerm = (name: string) => {
    const next = data?.find((entry) => entry.term === name);
    if (next) setActiveTerm(next);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {!data && isLoading ? (
        <ActivityIndicator
          color={theme.textSecondary}
          style={styles.stateSpinner}
        />
      ) : isError ? (
        <View style={styles.messageBox}>
          <Text style={[styles.title, { color: theme.text }]}>
            Could not load the dictionary
          </Text>
          <Pressable onPress={() => refetch()}>
            <Text style={[styles.retryText, { color: theme.text }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.searchRow}>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Search terms and definitions"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.searchInput,
                {
                  backgroundColor: theme.backgroundElement,
                  color: theme.text,
                },
              ]}
              value={query}
            />
            <Text style={[styles.count, { color: theme.textSecondary }]}>
              {filtered.length}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.catScroll}
            contentContainerStyle={styles.catRow}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => setCategoryFilter(null)}
              style={[
                styles.catChip,
                {
                  backgroundColor: !categoryFilter
                    ? theme.backgroundSelected
                    : theme.backgroundElement,
                },
              ]}
            >
              <Text style={[styles.catChipText, { color: theme.text }]}>
                All
              </Text>
            </Pressable>
            {categories.map((cat) => {
              const active = categoryFilter === cat;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={cat}
                  onPress={() => setCategoryFilter(active ? null : cat)}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: active
                        ? theme.backgroundSelected
                        : theme.backgroundElement,
                    },
                  ]}
                >
                  <Text style={[styles.catChipText, { color: theme.text }]}>
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            style={styles.listScroll}
          >
            {filtered.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text
                  style={[styles.emptyText, { color: theme.textSecondary }]}
                >
                  {categoryFilter
                    ? `No terms match “${query.trim()}” in ${categoryFilter}.`
                    : `No terms match “${query.trim()}”.`}
                </Text>
              </View>
            ) : (
              filtered.map((entry) => (
                <Pressable
                  accessibilityRole="button"
                  key={entry.term}
                  onPress={() => setActiveTerm(entry)}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: theme.backgroundElement },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.rowInfo}>
                    <Text
                      style={[styles.rowTitle, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {entry.term}
                    </Text>
                    {entry.category ? (
                      <Text
                        style={[styles.rowSub, { color: theme.textSecondary }]}
                        numberOfLines={1}
                      >
                        {entry.category}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={[styles.chevron, { color: theme.textSecondary }]}
                  >
                    ›
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>

          <TermModal
            onClose={() => setActiveTerm(null)}
            onSelectCategory={(cat) => {
              setCategoryFilter(cat);
              setActiveTerm(null);
            }}
            onSelectTerm={openTerm}
            term={activeTerm}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stateSpinner: {
    marginTop: 48,
  },
  messageBox: {
    gap: 8,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    borderRadius: 10,
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  count: {
    alignSelf: "center",
    fontSize: 12,
  },
  catScroll: {
    flexGrow: 0,
  },
  catRow: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  catChip: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  catChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  listScroll: {
    flex: 1,
  },
  list: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  rowSub: {
    fontSize: 12,
  },
  chevron: {
    fontSize: 20,
  },
  emptyBox: {
    alignItems: "center",
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
