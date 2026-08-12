import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import ChipSelect from "@/components/chip-select";
import { BREW_METHODS, RATING_SCALE } from "@/constants";
import type { BrewMethod, Rating } from "@/constants";
import { useBrewLogs } from "@/hooks/use-brew-logs";
import { useAuth } from "@/lib/auth-context";
import {
  computeHistoryStats,
  computeStreak,
  filterBrews,
} from "@/lib/history-stats";
import { useTheme } from "@/hooks/use-theme";
import type { BrewLog } from "@/types/brew-log";

type MethodFilter = BrewMethod | "all";
type RatingFilter = Rating | "all";

const RANGE_DAYS = [0, 7, 30] as const;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * History tab (T4): server-backed list with method/rating/date filters,
 * header summary (count, average rating, streak), and rows that open the
 * detail screen. Signed-out users see a sign-in prompt (history is per-account).
 */
export default function HistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, isConfigured } = useAuth();

  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [rangeDays, setRangeDays] = useState<number>(0);

  const {
    data: brews,
    isLoading,
    isError,
    refetch,
  } = useBrewLogs(user?.id ?? null);

  const filtered = useMemo(
    () =>
      filterBrews(brews ?? [], {
        method: methodFilter === "all" ? null : methodFilter,
        rating: ratingFilter === "all" ? null : ratingFilter,
        sinceDays: rangeDays === 0 ? null : rangeDays,
      }),
    [brews, methodFilter, ratingFilter, rangeDays],
  );

  const stats = useMemo(() => computeHistoryStats(filtered), [filtered]);
  const overallStreak = useMemo(() => computeStreak(brews ?? []), [brews]);
  const hasFilters =
    methodFilter !== "all" || ratingFilter !== "all" || rangeDays !== 0;

  const openBrew = (log: BrewLog) => router.push(`/brew/${log.id}`);

  if (!isConfigured || !user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.messageBox}>
          <Text style={[styles.title, { color: theme.text }]}>
            Your history
          </Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            Sign in to see your brew history.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/auth")}
          >
            <Text style={[styles.primaryButtonText, { color: theme.text }]}>
              Sign in
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator
          color={theme.textSecondary}
          style={styles.stateSpinner}
        />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.messageBox}>
          <Text style={[styles.title, { color: theme.text }]}>
            Could not load your history
          </Text>
          <Pressable onPress={() => refetch()}>
            <Text style={[styles.retryText, { color: theme.text }]}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.summaryRow,
          { borderBottomColor: theme.backgroundSelected },
        ]}
      >
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: theme.text }]}>
            {stats.count}
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
            brews
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: theme.text }]}>
            {stats.avgRating != null ? `★ ${stats.avgRating.toFixed(1)}` : "—"}
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
            avg rating
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: theme.text }]}>
            {overallStreak > 0
              ? `${overallStreak} day${overallStreak === 1 ? "" : "s"}`
              : "—"}
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
            streak
          </Text>
        </View>
      </View>

      <View style={styles.filters}>
        <ChipSelect<MethodFilter>
          accessibilityLabel="Filter by brew method"
          labelFor={(value) => (value === "all" ? "All" : value)}
          onChange={setMethodFilter}
          options={["all", ...BREW_METHODS] as MethodFilter[]}
          value={methodFilter}
        />
        <ChipSelect<RatingFilter>
          accessibilityLabel="Filter by rating"
          labelFor={(value) =>
            value === "all" ? "All ratings" : value.toFixed(1)
          }
          onChange={setRatingFilter}
          options={["all", ...RATING_SCALE] as RatingFilter[]}
          value={ratingFilter}
        />
        <ChipSelect<number>
          accessibilityLabel="Filter by date range"
          labelFor={(value) =>
            value === 0 ? "All time" : `Last ${value} days`
          }
          onChange={setRangeDays}
          options={[...RANGE_DAYS]}
          value={rangeDays}
        />
      </View>

      <ScrollView contentContainerStyle={styles.list} style={styles.listScroll}>
        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {brews && brews.length > 0
                ? "No brews match these filters."
                : "No brews yet — log your first brew."}
            </Text>
            {hasFilters ? (
              <Pressable
                onPress={() => {
                  setMethodFilter("all");
                  setRatingFilter("all");
                  setRangeDays(0);
                }}
              >
                <Text style={[styles.retryText, { color: theme.text }]}>
                  Clear filters
                </Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => router.push("/")}>
                <Text style={[styles.retryText, { color: theme.text }]}>
                  Go to Log
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          filtered.map((log) => (
            <Pressable
              accessibilityRole="button"
              key={log.id}
              onPress={() => openBrew(log)}
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
                  {log.beanName || log.origin || "Untitled brew"} · {log.method}
                </Text>
                <Text
                  style={[styles.rowSub, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {formatDate(log.brewedAt)}
                  {log.doseG != null || log.waterG != null
                    ? ` · ${log.doseG ?? "—"}g / ${log.waterG ?? "—"}ml`
                    : ""}
                  {log.ratio != null ? ` · 1:${log.ratio}` : ""}
                  {log.rating != null ? ` · ★${log.rating.toFixed(1)}` : ""}
                </Text>
              </View>
              <Text style={[styles.chevron, { color: theme.textSecondary }]}>
                ›
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
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
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    alignSelf: "flex-start",
    borderRadius: 10,
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  summaryRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    paddingVertical: 12,
  },
  summaryItem: {
    alignItems: "center",
    flex: 1,
    gap: 2,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  summaryLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filters: {
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    gap: 8,
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});
