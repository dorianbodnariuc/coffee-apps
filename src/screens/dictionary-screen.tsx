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
import { useSavedTermIds } from "@/hooks/use-saved-terms";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth-context";
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
  const { user } = useAuth();
  const savedIds = useSavedTermIds();
  const params = useLocalSearchParams<{ category?: string; term?: string }>();
  const [query, setQuery] = useState("");
  const [activeTerm, setActiveTerm] = useState<GlossaryTerm | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(
    () => params.category ?? null,
  );
  const [savedOnly, setSavedOnly] = useState(false);
  const [pendingTermSlug, setPendingTermSlug] = useState<string | null>(
    () => params.term ?? null,
  );
  // Arriving from another screen (e.g. a brew detail's glossary chip) with a
  // category param pre-selects that category. Render-phase adjustment (not an
  // effect) so it's lint-clean and immediate.
  const [lastParam, setLastParam] = useState(params.category);
  if (params.category !== lastParam) {
    setLastParam(params.category);
    if (params.category) setCategoryFilter(params.category);
  }
  // T17 return-to-term: after signing in from a term's save button, /auth sends
  // us here with a term slug. Reopen that term's modal once its data is
  // available (render-phase adjustment, no effect, no lint warning).
  const [lastTermParam, setLastTermParam] = useState(params.term);
  if (params.term !== lastTermParam) {
    setLastTermParam(params.term);
    if (params.term) setPendingTermSlug(params.term);
  }
  if (pendingTermSlug && data) {
    const target = data.find((t) => t.slug === pendingTermSlug);
    setPendingTermSlug(null);
    if (target) setActiveTerm(target);
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((t) => {
      (t.categories ?? []).forEach((c) => set.add(c));
    });
    return Array.from(set).sort();
  }, [data]);

  const inCategory = useMemo(
    () =>
      categoryFilter
        ? (data ?? []).filter((t) =>
            (t.categories ?? []).includes(categoryFilter),
          )
        : (data ?? []),
    [data, categoryFilter],
  );

  const savedOnlyActive = savedOnly && !!user;
  const inScope = useMemo(
    () =>
      savedOnlyActive
        ? inCategory.filter((t) => savedIds.data?.has(t.id) ?? false)
        : inCategory,
    [inCategory, savedOnlyActive, savedIds.data],
  );

  const filtered = useMemo(
    () => searchGlossaryTerms(inScope, query),
    [inScope, query],
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
            {user ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setSavedOnly((value) => !value)}
                style={[
                  styles.catChip,
                  {
                    backgroundColor: savedOnly
                      ? theme.backgroundSelected
                      : theme.backgroundElement,
                  },
                ]}
              >
                <Text style={[styles.catChipText, { color: theme.text }]}>
                  ★ Saved
                </Text>
              </Pressable>
            ) : null}
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
                  {savedOnly && user
                    ? query.trim()
                      ? `No saved terms match “${query.trim()}”.`
                      : "No saved terms yet — tap ☆ Save on a term to keep it here."
                    : categoryFilter
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
    borderRadius: 20,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 18,
  },
  catChipText: {
    fontSize: 14,
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
