import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import BrewLogForm from "@/components/brew-log-form";
import { useTheme } from "@/hooks/use-theme";
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
 */
export default function LogScreen() {
  const theme = useTheme();
  const [brews, setBrews] = useState<BrewLog[]>([]);

  const lastBrew = brews[0] ?? null;

  const handleSubmit = (input: BrewLogInput) => {
    const log: BrewLog = {
      ...input,
      id: `local-${Date.now()}`,
      ratio: deriveRatio(input),
      createdAt: new Date().toISOString(),
    };
    setBrews((prev) => [log, ...prev]);
  };

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
      <View
        style={[styles.footer, { borderTopColor: theme.backgroundSelected }]}
      >
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
          {brews.length === 0
            ? "No brews logged yet this session."
            : `${brews.length} brew${brews.length === 1 ? "" : "s"} logged — last: ${describeBrew(lastBrew!)}`}
        </Text>
        <Text style={[styles.footerCaption, { color: theme.textSecondary }]}>
          Session-only until Supabase lands (ticket T2).
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
