import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import BrewLogForm from "@/components/brew-log-form";
import { useAuth } from "@/lib/auth-context";
import { deriveBrewRatio } from "@/lib/ratio";
import { syncLocalBrews } from "@/lib/sync-local-brews";
import type { BrewLogInput } from "@/lib/brew-log-schema";
import type { BrewLog } from "@/types/brew-log";
import {
  useBrewLogs,
  useCreateBrewLog,
  useDeleteBrewLog,
} from "@/hooks/use-brew-logs";
import { useTheme } from "@/hooks/use-theme";

function describeBrew(log: BrewLog): string {
  const name = log.beanName || log.origin || "Untitled brew";
  const recipe =
    log.doseG != null || log.waterG != null
      ? ` · ${log.doseG ?? "—"}g / ${log.waterG ?? "—"}ml`
      : "";
  const stars = log.rating != null ? ` · ★${log.rating.toFixed(1)}` : "";
  return `${name} · ${log.method}${recipe}${stars}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Log tab (T3b): signed-in users get full Supabase persistence via React Query
 * (optimistic create/delete, server-backed list with delete+confirmation).
 * Signed-out users keep the local-first path: brews live in session state,
 * the soft wall prompts an account at brew #2, and local brews sync on
 * sign-in.
 */
export default function LogScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, isConfigured } = useAuth();
  const [localBrews, setLocalBrews] = useState<BrewLog[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const [syncRetry, setSyncRetry] = useState(0);
  const syncingRef = useRef(false);
  const [submitCount, setSubmitCount] = useState(0);
  const queryClient = useQueryClient();

  const signedIn = isConfigured && !!user;
  const userId = user?.id ?? null;

  const brewsQuery = useBrewLogs(userId);
  const createMutation = useCreateBrewLog(userId ?? "");
  const deleteMutation = useDeleteBrewLog(userId ?? "");

  const brews = signedIn ? (brewsQuery.data ?? []) : localBrews;
  const lastBrew = brews[0] ?? null;
  const saving = createMutation.isPending;

  // Sync session-local brews to the account on sign-in. Retries until success:
  // on failure local brews are kept and the footer offers Retry (bumps
  // syncRetry); the in-flight ref prevents duplicate concurrent syncs.
  useEffect(() => {
    if (!user || localBrews.length === 0 || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setSyncFailed(false);
    syncLocalBrews(localBrews).then((result) => {
      syncingRef.current = false;
      setSyncing(false);
      if (!result.error) {
        setLocalBrews([]);
        queryClient.invalidateQueries({ queryKey: ["brew-logs", user.id] });
      } else {
        setSyncFailed(true);
      }
    });
  }, [user, localBrews, syncRetry, queryClient]);

  const handleSubmit = (input: BrewLogInput) => {
    if (signedIn && userId) {
      createMutation.mutate(input);
    } else {
      const log: BrewLog = {
        ...input,
        id: `local-${Date.now()}`,
        ratio: deriveBrewRatio(input),
        createdAt: new Date().toISOString(),
      };
      setLocalBrews((prev) => [log, ...prev]);
    }
    setSubmitCount((n) => n + 1);
  };

  const handleDelete = (log: BrewLog) => {
    Alert.alert(
      "Delete brew",
      `Remove "${log.beanName || "this brew"}" from your history? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            if (signedIn && userId) deleteMutation.mutate(log.id);
            else setLocalBrews((prev) => prev.filter((l) => l.id !== log.id));
          },
        },
      ],
    );
  };

  const showSoftWall = !user && isConfigured && brews.length >= 2;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <BrewLogForm
        calculatorPrefill={
          lastBrew
            ? {
                doseG: lastBrew.doseG,
                waterG: lastBrew.waterG,
                ratio: lastBrew.ratio,
              }
            : null
        }
        key={submitCount}
        onSubmit={handleSubmit}
        submitting={saving}
      />

      {showSoftWall ? (
        <View
          style={[
            styles.softWall,
            { borderTopColor: theme.backgroundSelected },
          ]}
        >
          <Text style={[styles.softWallText, { color: theme.text }]}>
            Keep your brews safe — create a free account
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.softWallButton,
              { backgroundColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/auth")}
          >
            <Text style={[styles.softWallButtonText, { color: theme.text }]}>
              Sign up
            </Text>
          </Pressable>
        </View>
      ) : null}

      {signedIn ? (
        <View style={styles.savedSection}>
          <Text style={[styles.savedTitle, { color: theme.textSecondary }]}>
            Saved brews
          </Text>
          {brewsQuery.isLoading ? (
            <ActivityIndicator
              color={theme.textSecondary}
              style={styles.savedState}
            />
          ) : brewsQuery.isError ? (
            <View style={styles.savedState}>
              <Text style={[styles.savedEmpty, { color: theme.textSecondary }]}>
                Could not load your brews.
              </Text>
              <Pressable onPress={() => brewsQuery.refetch()}>
                <Text style={[styles.retryText, { color: theme.text }]}>
                  Retry
                </Text>
              </Pressable>
            </View>
          ) : brews.length === 0 ? (
            <Text style={[styles.savedEmpty, { color: theme.textSecondary }]}>
              No brews saved yet — log your first brew above.
            </Text>
          ) : (
            <ScrollView style={styles.savedList}>
              {brews.map((log) => (
                <View
                  key={log.id}
                  style={[
                    styles.brewRow,
                    { backgroundColor: theme.backgroundElement },
                  ]}
                >
                  <View style={styles.brewRowInfo}>
                    <Text
                      style={[styles.brewRowTitle, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {log.beanName || log.origin || "Untitled brew"} ·{" "}
                      {log.method}
                    </Text>
                    <Text
                      style={[
                        styles.brewRowSub,
                        { color: theme.textSecondary },
                      ]}
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
                  <Pressable
                    accessibilityLabel={`Delete ${log.beanName || "brew"}`}
                    hitSlop={8}
                    onPress={() => handleDelete(log)}
                  >
                    <Text
                      style={[
                        styles.deleteIcon,
                        { color: theme.textSecondary },
                      ]}
                    >
                      🗑
                    </Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}

      <View
        style={[styles.footer, { borderTopColor: theme.backgroundSelected }]}
      >
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
          {syncFailed
            ? "Could not sync your brews."
            : syncing
              ? "Syncing your brews…"
              : signedIn
                ? `${brews.length} brew${brews.length === 1 ? "" : "s"} saved`
                : brews.length === 0
                  ? "No brews logged yet this session."
                  : `${brews.length} brew${brews.length === 1 ? "" : "s"} logged — last: ${describeBrew(lastBrew!)}`}
        </Text>
        {syncFailed ? (
          <Pressable onPress={() => setSyncRetry((n) => n + 1)}>
            <Text style={[styles.retryText, { color: theme.text }]}>
              Retry sync
            </Text>
          </Pressable>
        ) : null}
        <Text style={[styles.footerCaption, { color: theme.textSecondary }]}>
          {signedIn
            ? "Saved to your account."
            : "Session-only until you create an account."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  softWall: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  softWallText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  softWallButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  softWallButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.7,
  },
  savedSection: {
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  savedTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  savedState: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingVertical: 8,
  },
  savedEmpty: {
    fontSize: 13,
  },
  retryText: {
    fontSize: 13,
    fontWeight: "600",
  },
  savedList: {
    maxHeight: 220,
  },
  brewRow: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    gap: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  brewRowInfo: {
    flex: 1,
    gap: 2,
  },
  brewRowTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  brewRowSub: {
    fontSize: 12,
  },
  deleteIcon: {
    fontSize: 15,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 2,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  footerText: {
    fontSize: 13,
  },
  footerCaption: {
    fontSize: 11,
    opacity: 0.7,
  },
});
