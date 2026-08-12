import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { ZodError } from "zod";

import ChipSelect from "@/components/chip-select";
import RatioCalculator, {
  type RatioValues,
} from "@/components/ratio-calculator";
import { BREW_METHODS, RATING_SCALE } from "@/constants";
import type { BrewMethod, Rating } from "@/constants";
import { useTheme } from "@/hooks/use-theme";
import { brewLogSchema, type BrewLogInput } from "@/lib/brew-log-schema";

export type BrewLogFormProps = {
  /** Prefill for the ratio calculator section (from the last brew). */
  calculatorPrefill?: RatioValues | null;
  /** Seed values for edit mode (T4 detail). Read once on mount — remount via key to change. */
  initialValues?: Partial<BrewLogInput>;
  onSubmit: (input: BrewLogInput) => void;
  submitLabel?: string;
  /** Disables the submit button and shows "Saving…" (T3b persistence). */
  submitting?: boolean;
};

type FieldErrors = Partial<Record<keyof BrewLogInput, string>>;

function formatDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Empty -> null; garbage -> null; valid -> rounded whole seconds. */
function parseSeconds(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function extractFieldErrors(error: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key as keyof BrewLogInput]) {
      out[key as keyof BrewLogInput] = issue.message;
    }
  }
  return out;
}

type FieldProps = {
  label: string;
  error?: string;
  children: React.ReactNode;
};

function Field({ label, error, children }: FieldProps) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        {label}
      </Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/**
 * Brew log create form (ticket T3, tasks 1–4): all fields, zod validation,
 * integrated collapsible ratio calculator (T5 module) prefilled from the last
 * brew, editable auto-filled date. Persistence (task 5) lands with T2.
 */
export default function BrewLogForm({
  calculatorPrefill,
  initialValues,
  onSubmit,
  submitLabel = "Save brew",
  submitting = false,
}: BrewLogFormProps) {
  const theme = useTheme();

  const [brewedAt, setBrewedAt] = useState(() =>
    initialValues?.brewedAt ? new Date(initialValues.brewedAt) : new Date(),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [method, setMethod] = useState<BrewMethod | null>(
    initialValues?.method ?? null,
  );
  const [beanName, setBeanName] = useState(initialValues?.beanName ?? "");
  const [roaster, setRoaster] = useState(initialValues?.roaster ?? "");
  const [origin, setOrigin] = useState(initialValues?.origin ?? "");
  const [grindSize, setGrindSize] = useState(initialValues?.grindSize ?? "");
  const [brewTime, setBrewTime] = useState(
    initialValues?.brewTimeSeconds != null
      ? String(initialValues.brewTimeSeconds)
      : "",
  );
  const [tastingNotes, setTastingNotes] = useState(
    initialValues?.tastingNotes ?? "",
  );
  const [rating, setRating] = useState<Rating | null>(
    (initialValues?.rating as Rating | null | undefined) ?? null,
  );
  const [ratioValues, setRatioValues] = useState<RatioValues>({
    doseG: null,
    waterG: null,
    ratio: null,
  });
  const [errors, setErrors] = useState<FieldErrors>({});

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text },
  ];
  const placeholderColor = theme.textSecondary;

  const clearErrors = () => {
    if (Object.keys(errors).length > 0) setErrors({});
  };

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (event.type === "dismissed") return;
    if (date) setBrewedAt(date);
    clearErrors();
  };

  const handleSubmit = () => {
    const draft = {
      brewedAt: brewedAt.toISOString(),
      beanName: beanName.trim(),
      roaster: roaster.trim(),
      origin: origin.trim(),
      method: method ?? "",
      grindSize: grindSize.trim(),
      doseG: ratioValues.doseG,
      waterG: ratioValues.waterG,
      brewTimeSeconds: parseSeconds(brewTime),
      tastingNotes: tastingNotes.trim(),
      rating,
    };
    const result = brewLogSchema.safeParse(draft);
    if (!result.success) {
      setErrors(extractFieldErrors(result.error));
      return;
    }

    setErrors({});
    onSubmit(result.data);

    // Fresh form; the parent remounts us (key) with the new last-brew prefill.
    setBrewedAt(new Date());
    setMethod(null);
    setBeanName("");
    setRoaster("");
    setOrigin("");
    setGrindSize("");
    setBrewTime("");
    setTastingNotes("");
    setRating(null);
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      style={styles.scroll}
    >
      {hasErrors ? (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: theme.backgroundSelected },
          ]}
        >
          <Text style={[styles.errorBannerText, { color: theme.text }]}>
            Fix the highlighted fields below.
          </Text>
        </View>
      ) : null}

      <Field label="When" error={errors.brewedAt}>
        <Pressable
          accessibilityLabel="Brew date and time"
          accessibilityRole="button"
          onPress={() => setShowDatePicker(true)}
          style={[styles.dateRow, { backgroundColor: theme.backgroundElement }]}
        >
          <Text style={[styles.dateText, { color: theme.text }]}>
            {formatDateTime(brewedAt)}
          </Text>
          <Text style={[styles.dateHint, { color: theme.textSecondary }]}>
            edit
          </Text>
        </Pressable>
        {showDatePicker ? (
          <DateTimePicker
            display={Platform.OS === "ios" ? "compact" : "default"}
            mode="datetime"
            onChange={handleDateChange}
            value={brewedAt}
          />
        ) : null}
      </Field>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Bean (snapshot)
        </Text>
        <Field label="Bean name" error={errors.beanName}>
          <TextInput
            accessibilityLabel="Bean name"
            onChangeText={(v) => {
              setBeanName(v);
              clearErrors();
            }}
            placeholder="e.g. Yirgacheffe"
            placeholderTextColor={placeholderColor}
            style={inputStyle}
            value={beanName}
          />
        </Field>
        <Field label="Roaster" error={errors.roaster}>
          <TextInput
            accessibilityLabel="Roaster"
            onChangeText={(v) => {
              setRoaster(v);
              clearErrors();
            }}
            placeholder="e.g. Local Roasters"
            placeholderTextColor={placeholderColor}
            style={inputStyle}
            value={roaster}
          />
        </Field>
        <Field label="Origin" error={errors.origin}>
          <TextInput
            accessibilityLabel="Origin"
            onChangeText={(v) => {
              setOrigin(v);
              clearErrors();
            }}
            placeholder="e.g. Ethiopia"
            placeholderTextColor={placeholderColor}
            style={inputStyle}
            value={origin}
          />
        </Field>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Method & recipe
        </Text>
        <Field label="Brew method" error={errors.method}>
          <ChipSelect
            accessibilityLabel="Brew method"
            onChange={(v) => {
              setMethod(v);
              clearErrors();
            }}
            options={BREW_METHODS}
            value={method}
          />
        </Field>
        <Field label="Grind size" error={errors.grindSize}>
          <TextInput
            accessibilityLabel="Grind size"
            onChangeText={(v) => {
              setGrindSize(v);
              clearErrors();
            }}
            placeholder="e.g. medium-fine"
            placeholderTextColor={placeholderColor}
            style={inputStyle}
            value={grindSize}
          />
        </Field>
        <Field label="Brew time (seconds)" error={errors.brewTimeSeconds}>
          <TextInput
            accessibilityLabel="Brew time in seconds"
            keyboardType="number-pad"
            onChangeText={(v) => {
              setBrewTime(v);
              clearErrors();
            }}
            placeholder="e.g. 150"
            placeholderTextColor={placeholderColor}
            style={inputStyle}
            value={brewTime}
          />
        </Field>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Ratio
        </Text>
        <RatioCalculator
          initialValues={calculatorPrefill ?? undefined}
          onChange={(values) => {
            setRatioValues(values);
            clearErrors();
          }}
        />
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Fill any two — dose, water, ratio — the third computes itself. Ratio
          is read-only in the log: it derives from dose and water.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Tasting
        </Text>
        <Field label="Notes" error={errors.tastingNotes}>
          <TextInput
            accessibilityLabel="Tasting notes"
            multiline
            onChangeText={(v) => {
              setTastingNotes(v);
              clearErrors();
            }}
            placeholder="Floral, tea-like, bright…"
            placeholderTextColor={placeholderColor}
            style={[inputStyle, styles.notesInput]}
            textAlignVertical="top"
            value={tastingNotes}
          />
        </Field>
        <Field label="Rating" error={errors.rating}>
          <ChipSelect
            accessibilityLabel="Rating"
            labelFor={(v) => v.toFixed(1)}
            onChange={(v) => {
              setRating(v);
              clearErrors();
            }}
            options={RATING_SCALE}
            value={rating}
          />
        </Field>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={submitting}
        onPress={handleSubmit}
        style={[styles.submit, { backgroundColor: theme.backgroundSelected }]}
      >
        <Text style={[styles.submitText, { color: theme.text }]}>
          {submitting ? "Saving…" : submitLabel}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  errorBanner: {
    borderRadius: 10,
    padding: 12,
  },
  errorBannerText: {
    fontSize: 14,
    fontWeight: "500",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateText: {
    fontSize: 15,
  },
  dateHint: {
    fontSize: 13,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  field: {
    gap: 4,
  },
  label: {
    fontSize: 13,
  },
  input: {
    borderRadius: 8,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notesInput: {
    minHeight: 88,
  },
  error: {
    color: "#d64545",
    fontSize: 12,
  },
  hint: {
    fontSize: 12,
  },
  submit: {
    alignItems: "center",
    borderRadius: 10,
    marginTop: 4,
    paddingVertical: 14,
  },
  submitText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
