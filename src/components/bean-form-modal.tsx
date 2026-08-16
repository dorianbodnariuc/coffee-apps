import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { useGetOrCreateOrigin, useGetOrCreateRoaster, useOrigins, useRoasters } from "@/hooks/use-catalog";
import { beanSchema, type BeanInput } from "@/lib/bean-schema";
import { Radius } from "@/constants/theme";
import AutocompleteInput, {
  type AutocompleteOption,
} from "@/components/autocomplete-input";
import type { Bean } from "@/types/bean";

export type BeanFormModalProps = {
  /** Seed for edit mode (null = create). Read once on mount — remount via key. */
  initial: Bean | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: BeanInput) => void;
  onDelete?: () => void;
  /** The user's existing bean names (bean-name autocomplete, D-033). */
  suggestedBeanNames?: string[];
};

function toDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateOnly(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date();
}

/**
 * Add/edit a cellar bean. Bean name / roaster / origin are type-ahead inputs
 * (D-033): selecting a catalog row fills the field and links `roaster_id`/
 * `origin_id`; "Add new" creates a name-only global row. Free text is always
 * accepted. Backdrop = View + absolute-fill tap-to-close (never nests buttons).
 */
export default function BeanFormModal({
  initial,
  busy,
  onClose,
  onSubmit,
  onDelete,
  suggestedBeanNames = [],
}: BeanFormModalProps) {
  const theme = useTheme();
  const [name, setName] = useState(initial?.name ?? "");
  const [roaster, setRoaster] = useState(initial?.roaster ?? "");
  const [origin, setOrigin] = useState(initial?.origin ?? "");
  const [roasterId, setRoasterId] = useState<string | null>(
    initial?.roasterId ?? null,
  );
  const [originId, setOriginId] = useState<string | null>(
    initial?.originId ?? null,
  );
  const [roastDate, setRoastDate] = useState<string | null>(
    initial?.roastDate ?? null,
  );
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: origins = [] } = useOrigins();
  const { data: roasters = [] } = useRoasters();
  const createOrigin = useGetOrCreateOrigin();
  const createRoaster = useGetOrCreateRoaster();

  const originOptions: AutocompleteOption[] = origins.map((o) => ({
    id: o.id,
    label: o.name,
    sublabel: o.region ? (o.country ?? undefined) : undefined,
  }));

  const roasterOptions: AutocompleteOption[] = roasters.map((r) => ({
    id: r.id,
    label: r.name,
    sublabel: r.city ?? r.country ?? undefined,
  }));

  const beanNameOptions: AutocompleteOption[] = (() => {
    const seen = new Set<string>();
    const out: AutocompleteOption[] = [];
    for (const label of [
      ...suggestedBeanNames,
      ...origins.map((o) => o.name),
    ]) {
      const key = label.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ id: label, label });
    }
    return out;
  })();

  // Roaster: manual typing unlinks the catalog row; select/create link it.
  const handleRoasterChange = (text: string) => {
    setRoaster(text);
    setRoasterId(null);
  };
  const handleSelectRoaster = (option: AutocompleteOption) => {
    setRoaster(option.label);
    setRoasterId(option.id);
  };
  const handleCreateRoaster = (text: string) => {
    createRoaster.mutate(text, {
      onSuccess: (r) => {
        setRoaster(r.name);
        setRoasterId(r.id);
      },
    });
  };

  const handleOriginChange = (text: string) => {
    setOrigin(text);
    setOriginId(null);
  };
  const handleSelectOrigin = (option: AutocompleteOption) => {
    setOrigin(option.label);
    setOriginId(option.id);
  };
  const handleCreateOrigin = (text: string) => {
    createOrigin.mutate(text, {
      onSuccess: (o) => {
        setOrigin(o.name);
        setOriginId(o.id);
      },
    });
  };

  const handleSave = () => {
    const result = beanSchema.safeParse({
      name,
      roaster,
      origin,
      roasterId,
      originId,
      roastDate,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check the fields");
      return;
    }
    setError(null);
    onSubmit(result.data);
  };

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setShowPicker(false);
    if (event.type === "dismissed") return;
    if (date) setRoastDate(toDateString(date));
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
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
          <ScrollView
            contentContainerStyle={styles.cardContent}
            keyboardShouldPersistTaps="handled"
            style={styles.cardScroll}
          >
            <Text style={[styles.title, { color: theme.text }]}>
              {initial ? "Edit bean" : "Add bean"}
            </Text>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Bean name
              </Text>
              <AutocompleteInput
                accessibilityLabel="Bean name"
                autoFocus
                onChangeText={setName}
                onSelect={(option) => setName(option.label)}
                options={beanNameOptions}
                placeholder="e.g. Yirgacheffe"
                value={name}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Roaster
              </Text>
              <AutocompleteInput
                accessibilityLabel="Roaster"
                allowCreate
                onChangeText={handleRoasterChange}
                onCreate={handleCreateRoaster}
                onSelect={handleSelectRoaster}
                options={roasterOptions}
                placeholder="e.g. Blue Bottle Coffee"
                value={roaster}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Origin
              </Text>
              <AutocompleteInput
                accessibilityLabel="Origin"
                allowCreate
                onChangeText={handleOriginChange}
                onCreate={handleCreateOrigin}
                onSelect={handleSelectOrigin}
                options={originOptions}
                placeholder="e.g. Ethiopia"
                value={origin}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Roast date
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowPicker(true)}
                style={[
                  styles.dateRow,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
                <Text style={[styles.dateText, { color: theme.text }]}>
                  {roastDate ?? "Not set"}
                </Text>
                <Text style={[styles.dateHint, { color: theme.textSecondary }]}>
                  {roastDate ? "edit" : "set"}
                </Text>
              </Pressable>
              {roastDate ? (
                <Pressable onPress={() => setRoastDate(null)}>
                  <Text
                    style={[styles.clearText, { color: theme.textSecondary }]}
                  >
                    Clear date
                  </Text>
                </Pressable>
              ) : null}
              {showPicker ? (
                <DateTimePicker
                  display={Platform.OS === "ios" ? "compact" : "default"}
                  mode="date"
                  onChange={handleDateChange}
                  value={roastDate ? parseDateOnly(roastDate) : new Date()}
                />
              ) : null}
            </View>

            {error ? (
              <Text style={[styles.error, { color: theme.danger }]}>
                {error}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={handleSave}
              style={[
                styles.save,
                { backgroundColor: theme.primary },
                busy && styles.disabled,
              ]}
            >
              <Text style={[styles.saveText, { color: theme.onPrimary }]}>
                {busy ? "Saving…" : initial ? "Save changes" : "Add bean"}
              </Text>
            </Pressable>

            {onDelete ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={onDelete}
                style={[
                  styles.delete,
                  { backgroundColor: theme.dangerBackground },
                  busy && styles.disabled,
                ]}
              >
                <Text style={[styles.deleteText, { color: theme.dangerText }]}>
                  Delete bean
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    alignSelf: "center",
    borderRadius: Radius.lg,
    maxHeight: "85%",
    maxWidth: 480,
    padding: 20,
    width: "100%",
  },
  cardScroll: {
    flexShrink: 1,
  },
  cardContent: {
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  field: {
    gap: 4,
  },
  label: {
    fontSize: 13,
  },
  dateRow: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateText: {
    fontSize: 15,
  },
  dateHint: {
    fontSize: 13,
  },
  clearText: {
    fontSize: 13,
    marginTop: 4,
  },
  error: {
    fontSize: 13,
  },
  save: {
    alignItems: "center",
    borderRadius: Radius.md,
    justifyContent: "center",
    marginTop: 4,
    minHeight: 48,
    paddingVertical: 12,
  },
  saveText: {
    fontSize: 16,
    fontWeight: "600",
  },
  delete: {
    alignItems: "center",
    borderRadius: Radius.md,
    justifyContent: "center",
    minHeight: 48,
    paddingVertical: 12,
  },
  deleteText: {
    fontSize: 16,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
});
