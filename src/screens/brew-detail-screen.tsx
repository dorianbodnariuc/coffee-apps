import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import BrewLogForm from "@/components/brew-log-form";
import TermModal from "@/components/term-modal";
import {
  useBrewLogs,
  useDeleteBrewLog,
  useUpdateBrewLog,
} from "@/hooks/use-brew-logs";
import { useGlossaryTerms } from "@/hooks/use-glossary";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth-context";
import { matchGlossaryTerms, type GlossaryTerm } from "@/lib/glossary-match";
import type { BrewLogInput } from "@/lib/brew-log-schema";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatBrewTime(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Brew log detail (T4): full field view with edit (reuses BrewLogForm in
 * seeded mode) and delete (destructive confirm) entry points.
 */
export default function BrewDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isConfigured } = useAuth();
  const { data, isLoading, isError, refetch } = useBrewLogs(user?.id ?? null);
  const updateMutation = useUpdateBrewLog(user?.id ?? "");
  const deleteMutation = useDeleteBrewLog(user?.id ?? "");
  const glossaryQuery = useGlossaryTerms();
  const [editing, setEditing] = useState(false);
  const [activeTerm, setActiveTerm] = useState<GlossaryTerm | null>(null);

  const brew = data?.find((entry) => entry.id === id);

  // T7: chips for glossary terms found in this log's tasting notes.
  const matchedTerms = useMemo(
    () =>
      brew
        ? matchGlossaryTerms(brew.tastingNotes, glossaryQuery.data ?? [])
        : [],
    [brew, glossaryQuery.data],
  );

  const handleDelete = () => {
    if (!brew) return;
    Alert.alert(
      "Delete brew",
      `Remove "${brew.beanName || "this brew"}" from your history? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteMutation.mutate(id, { onSuccess: () => router.back() }),
        },
      ],
    );
  };

  const handleUpdate = (input: BrewLogInput) => {
    updateMutation.mutate(
      { id, input },
      { onSuccess: () => setEditing(false) },
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        onPress={() => router.back()}
      >
        <Text style={[styles.backText, { color: theme.text }]}>‹ Back</Text>
      </Pressable>

      {updateMutation.isError || deleteMutation.isError ? (
        <View style={styles.mutationErrorBox}>
          <Text style={styles.mutationErrorText}>
            Something went wrong — your changes weren’t saved. Please try again.
          </Text>
        </View>
      ) : null}

      {!isConfigured || !user ? (
        <View style={styles.stateBox}>
          <Text style={[styles.stateText, { color: theme.textSecondary }]}>
            Sign in to view brew details.
          </Text>
        </View>
      ) : isLoading ? (
        <ActivityIndicator
          color={theme.textSecondary}
          style={styles.stateSpinner}
        />
      ) : isError ? (
        <View style={styles.stateBox}>
          <Text style={[styles.stateText, { color: theme.textSecondary }]}>
            Could not load this brew.
          </Text>
          <Pressable onPress={() => refetch()}>
            <Text style={[styles.actionText, { color: theme.text }]}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : !brew ? (
        <View style={styles.stateBox}>
          <Text style={[styles.stateText, { color: theme.textSecondary }]}>
            Brew not found.
          </Text>
        </View>
      ) : editing ? (
        <BrewLogForm
          calculatorPrefill={{
            doseG: brew.doseG,
            waterG: brew.waterG,
            ratio: brew.ratio,
          }}
          initialValues={brew}
          onSubmit={handleUpdate}
          submitLabel="Save changes"
          submitting={updateMutation.isPending}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>
            {brew.beanName || brew.origin || "Untitled brew"}
          </Text>
          <Text style={[styles.meta, { color: theme.textSecondary }]}>
            {formatDateTime(brew.brewedAt)} · {brew.method}
          </Text>

          <View style={styles.fields}>
            <Field label="Roaster" value={brew.roaster || "—"} theme={theme} />
            <Field label="Origin" value={brew.origin || "—"} theme={theme} />
            <Field
              label="Grind size"
              value={brew.grindSize || "—"}
              theme={theme}
            />
            <Field
              label="Recipe"
              value={
                brew.doseG != null || brew.waterG != null
                  ? `${brew.doseG ?? "—"}g / ${brew.waterG ?? "—"}ml${brew.ratio != null ? ` · 1:${brew.ratio}` : ""}`
                  : "—"
              }
              theme={theme}
            />
            <Field
              label="Brew time"
              value={formatBrewTime(brew.brewTimeSeconds)}
              theme={theme}
            />
            <Field
              label="Rating"
              value={brew.rating != null ? `★ ${brew.rating.toFixed(1)}` : "—"}
              theme={theme}
            />
            <Field
              label="Notes"
              value={brew.tastingNotes || "—"}
              theme={theme}
            />
          </View>

          {matchedTerms.length > 0 ? (
            <View style={styles.glossaryBox}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Glossary
              </Text>
              <View style={styles.chipRow}>
                {matchedTerms.map((term) => (
                  <Pressable
                    accessibilityRole="button"
                    key={term.term}
                    onPress={() => setActiveTerm(term)}
                    style={({ pressed }) => [
                      styles.chip,
                      { backgroundColor: theme.backgroundElement },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.chipText, { color: theme.text }]}>
                      {term.term}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}
            onPress={() => setEditing(true)}
          >
            <Text style={[styles.buttonText, { color: theme.text }]}>
              Edit brew
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.dangerButton,
              pressed && styles.pressed,
            ]}
            onPress={handleDelete}
          >
            <Text style={[styles.buttonText, styles.dangerText]}>
              Delete brew
            </Text>
          </Pressable>
        </ScrollView>
      )}

      <TermModal
        onClose={() => setActiveTerm(null)}
        onSelectTerm={(name) => {
          const next = glossaryQuery.data?.find((t) => t.term === name);
          if (next) setActiveTerm(next);
        }}
        term={activeTerm}
      />
    </View>
  );
}

function Field({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: { text: string; textSecondary: string };
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.fieldValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backText: {
    fontSize: 16,
  },
  stateSpinner: {
    marginTop: 40,
  },
  stateBox: {
    alignItems: "center",
    gap: 8,
    padding: 24,
  },
  stateText: {
    fontSize: 14,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  mutationErrorBox: {
    backgroundColor: "#3D1A1A",
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
  },
  mutationErrorText: {
    color: "#E57373",
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
  },
  content: {
    gap: 16,
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  meta: {
    fontSize: 13,
    marginTop: -8,
  },
  fields: {
    gap: 10,
  },
  fieldRow: {
    gap: 2,
  },
  fieldLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 15,
  },
  glossaryBox: {
    gap: 6,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  button: {
    alignItems: "center",
    borderRadius: 10,
    paddingVertical: 14,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  dangerButton: {
    backgroundColor: "#3D1A1A",
  },
  dangerText: {
    color: "#E57373",
  },
});
