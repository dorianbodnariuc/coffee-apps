import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import BrewLogForm from "@/components/brew-log-form";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth-context";
import { syncLocalBrews } from "@/lib/sync-local-brews";
import type { BrewLogInput } from "@/lib/brew-log-schema";
import type { BrewLog } from "@/types/brew-log";

function deriveRatio(input: BrewLogInput): number | null {
  if (input.doseG == null || input.doseG <= 0 || input.waterG == null)
    return null;
  return Math.round((input.waterG / input.doseG) * 10) / 10;
}

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
 * Log tab: the brew log form (T3) with a session-local submit loop so the
 * create flow is verifiable end-to-end before Supabase lands (T2/T3b).
 * Each submit remounts the form prefilled with the last brew's ratio values.
 *
 * Soft wall (T2): after the 2nd brew, a signed-out user is prompted to create
 * an account. On sign-in, session-local brews sync to the account once.
 */
export default function LogScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, isConfigured } = useAuth();
  const [brews, setBrews] = useState<BrewLog[]>([]);
  const [syncing, setSyncing] = useState(false);
  const syncedRef = useRef(false);

  const lastBrew = brews[0] ?? null;

  useEffect(() => {
    if (!user || syncedRef.current || brews.length === 0) return;
    syncedRef.current = true;
    setSyncing(true);
    syncLocalBrews(brews).then((result) => {
      setSyncing(false);
      if (!result.error) setBrews([]);
    });
  }, [user, brews]);

  const handleSubmit = (input: BrewLogInput) => {
    const log: BrewLog = {
      ...input,
      id: `local-${Date.now()}`,
      ratio: deriveRatio(input),
      createdAt: new Date().toISOString(),
    };
    setBrews((prev) => [log, ...prev]);
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
        key={brews.length}
        onSubmit={handleSubmit}
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
          {syncing
            ? "Syncing your brews…"
            : brews.length === 0
              ? "No brews logged yet this session."
              : `${brews.length} brew${brews.length === 1 ? "" : "s"} logged — last: ${describeBrew(lastBrew!)}`}
        </Text>
        <Text style={[styles.footerCaption, { color: theme.textSecondary }]}>
          {user
            ? "Brews sync to your account."
            : "Session-only until Supabase lands (ticket T2)."}
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
