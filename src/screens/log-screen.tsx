import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import BrewLogForm from "@/components/brew-log-form";
import { useAuth } from "@/lib/auth-context";
import { deriveBrewRatio } from "@/lib/ratio";
import { syncLocalBrews } from "@/lib/sync-local-brews";
import type { BrewLogInput } from "@/lib/brew-log-schema";
import type { BrewLog } from "@/types/brew-log";
import { useBrewLogs, useCreateBrewLog } from "@/hooks/use-brew-logs";
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

/**
 * Log tab (T3b): signed-in users get full Supabase persistence via React Query
 * (optimistic create). Signed-out users keep the local-first path: brews live
 * in session state, the soft wall prompts an account at brew #2, and local
 * brews sync on sign-in (retrying until success). History lives on the
 * History tab (T4).
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
  retryText: {
    fontSize: 13,
    fontWeight: "600",
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
