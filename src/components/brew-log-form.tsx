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
import { METHOD_SPECS, methodLabel, type MethodParam } from "@/constants/method-specs";
import { useTheme } from "@/hooks/use-theme";
import { brewLogSchema, type BrewLogInput } from "@/lib/brew-log-schema";

export type BrewLogFormProps = {
  /** Prefill for the ratio calculator section (dose from the last brew). */
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

/** Empty -> null; garbage -> null; valid -> the number (no rounding). */
function parseOptionalNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
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

/** Convert raw string params into typed `method_params` per the method spec. */
function buildMethodParams(
  method: BrewMethod | null,
  params: Record<string, string>,
): Record<string, unknown> {
  if (!method) return {};
  const out: Record<string, unknown> = {};
  for (const p of METHOD_SPECS[method].params) {
    const raw = params[p.key];
    if (raw == null || raw.trim() === "") continue;
    if (p.spec.kind === "number") {
      const n = Number(raw);
      if (Number.isFinite(n)) out[p.key] = n;
    } else {
      out[p.key] = raw.trim();
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
 * Brew log create/edit form (ticket T3, revised T23): method-first with
 * method-specific parameters from METHOD_SPECS, grinder + grind setting as a
 * pair, and a method-aware ratio (yield for espresso). Only `method` is
 * required; every other field is optional. Persistence is the parent's job.
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
  const [grinder, setGrinder] = useState(initialValues?.grinder ?? "");
  const [grindSize, setGrindSize] = useState(initialValues?.grindSize ?? "");
  const [waterTempC, setWaterTempC] = useState(
    initialValues?.waterTempC != null ? String(initialValues.waterTempC) : "",
  );
  const [params, setParams] = useState<Record<string, string>>(() => {
    const mp = initialValues?.methodParams ?? {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(mp)) {
      if (v == null) continue;
      out[k] = String(v);
    }
    return out;
  });
  const [recipeOpen, setRecipeOpen] = useState(false);
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

  // Initial ratio-calculator seed: edit mode uses the brew's own values
  // (yield mapped to the liquid field for espresso); new logs prefill only
  // dose (method-independent) from the last brew.
  const initialCalc: RatioValues = (() => {
    if (initialValues) {
      const m = initialValues.method;
      return {
        doseG: initialValues.doseG ?? null,
        waterG:
          m === "espresso"
            ? initialValues.yieldG ?? null
            : initialValues.waterG ?? null,
        ratio: null,
      };
    }
    return {
      doseG: calculatorPrefill?.doseG ?? null,
      waterG: calculatorPrefill?.waterG ?? null,
      ratio: calculatorPrefill?.ratio ?? null,
    };
  })();
  const [calcSeed, setCalcSeed] = useState<RatioValues>(initialCalc);
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

  const handleMethodChange = (v: BrewMethod) => {
    setMethod(v);
    setParams({});
    // Reset the ratio liquid (water/yield semantics change with method);
    // keep dose, which is method-independent.
    setCalcSeed({ doseG: ratioValues.doseG, waterG: null, ratio: null });
    clearErrors();
  };

  const setParam = (key: string, value: string) => {
    setParams((prev) => ({ ...prev, [key]: value }));
    clearErrors();
  };

  const handleSubmit = () => {
    const isEspresso = method === "espresso";
    const draft = {
      brewedAt: brewedAt.toISOString(),
      beanName: beanName.trim(),
      roaster: roaster.trim(),
      origin: origin.trim(),
      method: method ?? "",
      grinder: grinder.trim(),
      grindSize: grindSize.trim(),
      doseG: ratioValues.doseG,
      waterG: isEspresso ? null : ratioValues.waterG,
      yieldG: isEspresso ? ratioValues.waterG : null,
      waterTempC: parseOptionalNumber(waterTempC),
      brewTimeSeconds: parseSeconds(brewTime),
      tastingNotes: tastingNotes.trim(),
      rating,
      methodParams: buildMethodParams(method, params),
    };
    const result = brewLogSchema.safeParse(draft);
    if (!result.success) {
      setErrors(extractFieldErrors(result.error));
      return;
    }

    setErrors({});
    onSubmit(result.data);
    // We deliberately do NOT clear the form here: the parent resets us on
    // success (LogScreen remounts via key; BrewDetailScreen unmounts on
    // setEditing(false)). Keeping state means a failed save leaves the user's
    // input intact so they can retry without retyping.
  };

  const methodParams = method ? METHOD_SPECS[method].params : [];
  const hasErrors = Object.keys(errors).length > 0;

  const renderParam = (p: MethodParam) => {
    const value = params[p.key] ?? "";
    if (p.spec.kind === "enum") {
      return (
        <Field key={p.key} label={p.label}>
          <ChipSelect<string>
            accessibilityLabel={p.label}
            onChange={(v) => setParam(p.key, v)}
            options={p.spec.options as readonly string[]}
            value={value === "" ? null : value}
          />
        </Field>
      );
    }
    const isNumber = p.spec.kind === "number";
    const unit = p.spec.kind === "number" ? p.spec.unit ?? "" : "";
    return (
      <Field key={p.key} label={p.label}>
        <TextInput
          accessibilityLabel={p.label}
          keyboardType={isNumber ? "decimal-pad" : "default"}
          onChangeText={(v) => setParam(p.key, v)}
          placeholder={unit ? `0 ${unit}` : "0"}
          placeholderTextColor={placeholderColor}
          style={inputStyle}
          value={value}
        />
      </Field>
    );
  };

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
            labelFor={methodLabel}
            onChange={handleMethodChange}
            options={BREW_METHODS}
            value={method}
          />
        </Field>
        <Field label="Grinder" error={errors.grinder}>
          <TextInput
            accessibilityLabel="Grinder"
            onChangeText={(v) => {
              setGrinder(v);
              clearErrors();
            }}
            placeholder="e.g. Eureka Mignon"
            placeholderTextColor={placeholderColor}
            style={inputStyle}
            value={grinder}
          />
        </Field>
        <Field label="Grind size" error={errors.grindSize}>
          <TextInput
            accessibilityLabel="Grind size"
            onChangeText={(v) => {
              setGrindSize(v);
              clearErrors();
            }}
            placeholder="e.g. 12"
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
          initialValues={calcSeed}
          key={method ?? "none"}
          method={method}
          onChange={(values) => {
            setRatioValues(values);
            clearErrors();
          }}
        />
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          {method === "espresso"
            ? "Espresso ratio is yield ÷ dose. Fill dose and yield — the ratio computes itself."
            : "Fill any two — dose, water, ratio — the third computes itself."}
        </Text>
      </View>

      <View style={styles.section}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setRecipeOpen((o) => !o)}
          style={[styles.detailHeader, { backgroundColor: theme.backgroundElement }]}
        >
          <Text style={[styles.detailHeaderText, { color: theme.text }]}>
            Recipe details
          </Text>
          <Text style={[styles.detailChevron, { color: theme.textSecondary }]}>
            {recipeOpen ? "▾" : "▸"}
          </Text>
        </Pressable>
        {recipeOpen ? (
          <View style={styles.detailBody}>
            <Field label="Water temperature (°C)" error={errors.waterTempC}>
              <TextInput
                accessibilityLabel="Water temperature in Celsius"
                keyboardType="decimal-pad"
                onChangeText={(v) => {
                  setWaterTempC(v);
                  clearErrors();
                }}
                placeholder="e.g. 93"
                placeholderTextColor={placeholderColor}
                style={inputStyle}
                value={waterTempC}
              />
            </Field>
            {methodParams.map(renderParam)}
            {errors.methodParams ? (
              <Text style={styles.error}>{errors.methodParams}</Text>
            ) : null}
          </View>
        ) : null}
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
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  detailHeaderText: {
    fontSize: 15,
    fontWeight: "600",
  },
  detailChevron: {
    fontSize: 14,
  },
  detailBody: {
    gap: 12,
    paddingTop: 4,
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
