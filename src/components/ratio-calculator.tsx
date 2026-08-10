import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { RATIO_PRESETS } from "@/constants";
import { useTheme } from "@/hooks/use-theme";
import { solveRatio } from "@/lib/ratio";

export type RatioValues = {
  doseG: number | null;
  waterG: number | null;
  ratio: number | null;
};

type RatioField = keyof RatioValues;

type RatioCalculatorProps = {
  /** Prefill values (e.g. from the last brew log). */
  initialValues?: Partial<RatioValues>;
  /** Fired whenever the effective values change: user-typed fields plus the auto-computed third. */
  onChange?: (values: RatioValues) => void;
};

function toNum(text: string): number | null {
  if (text.trim() === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/**
 * Collapsible "Calculate ratio" widget: three linked numeric inputs
 * (dose g / water g-ml / ratio) — fill any two, the third auto-computes live.
 * Preset chips (1:15 / 1:16 / 1:17) prefill the ratio input.
 *
 * Pure presentational: no API/DB calls, no global state. All math lives in
 * src/lib/ratio.ts; presets come from src/constants.
 */
export default function RatioCalculator({
  initialValues,
  onChange,
}: RatioCalculatorProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [dose, setDose] = useState(
    initialValues?.doseG != null ? String(initialValues.doseG) : "",
  );
  const [water, setWater] = useState(
    initialValues?.waterG != null ? String(initialValues.waterG) : "",
  );
  const [ratio, setRatio] = useState(
    initialValues?.ratio != null ? String(initialValues.ratio) : "",
  );

  const parsed = useMemo(
    () => ({ doseG: toNum(dose), waterG: toNum(water), ratio: toNum(ratio) }),
    [dose, water, ratio],
  );

  // Solution = the third value computed from whichever two fields are filled.
  const solution = useMemo(() => solveRatio(parsed), [parsed]);

  // Effective values: the user's text when present, otherwise the computed third.
  const effective = useMemo<RatioValues>(() => {
    const text = { doseG: dose, waterG: water, ratio };
    const pick = (field: RatioField): number | null => {
      if (text[field].trim() !== "") return parsed[field];
      return solution?.[field] ?? null;
    };
    return {
      doseG: pick("doseG"),
      waterG: pick("waterG"),
      ratio: pick("ratio"),
    };
  }, [dose, water, ratio, parsed, solution]);

  useEffect(() => {
    onChange?.(effective);
  }, [effective, onChange]);

  const setField = (field: RatioField) => (value: string) => {
    if (field === "doseG") setDose(value);
    else if (field === "waterG") setWater(value);
    else setRatio(value);
  };

  const displayValue = (field: RatioField): string => {
    const text = { doseG: dose, waterG: water, ratio }[field];
    if (text.trim() !== "") return text;
    const derived = effective[field];
    return derived != null ? String(derived) : "";
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text },
  ];
  const placeholderColor = theme.textSecondary;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen((v) => !v)}
        style={[styles.header, { backgroundColor: theme.backgroundElement }]}
      >
        <Text style={[styles.headerText, { color: theme.text }]}>
          Calculate ratio
        </Text>
        <Text style={[styles.headerChevron, { color: theme.textSecondary }]}>
          {open ? "▾" : "▸"}
        </Text>
      </Pressable>

      {open && (
        <View style={styles.body}>
          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Dose (g)
              </Text>
              <TextInput
                accessibilityLabel="Dose in grams"
                keyboardType="decimal-pad"
                onChangeText={setField("doseG")}
                placeholder="0"
                placeholderTextColor={placeholderColor}
                style={inputStyle}
                value={displayValue("doseG")}
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Water (g/ml)
              </Text>
              <TextInput
                accessibilityLabel="Water in grams or milliliters"
                keyboardType="decimal-pad"
                onChangeText={setField("waterG")}
                placeholder="0"
                placeholderTextColor={placeholderColor}
                style={inputStyle}
                value={displayValue("waterG")}
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Ratio (1:x)
              </Text>
              <TextInput
                accessibilityLabel="Brew ratio"
                keyboardType="decimal-pad"
                onChangeText={setField("ratio")}
                placeholder="15"
                placeholderTextColor={placeholderColor}
                style={inputStyle}
                value={displayValue("ratio")}
              />
            </View>
          </View>

          <View style={styles.presets}>
            {RATIO_PRESETS.map((preset) => (
              <Pressable
                accessibilityRole="button"
                key={preset}
                onPress={() => setRatio(String(preset))}
                style={[
                  styles.chip,
                  { backgroundColor: theme.backgroundSelected },
                ]}
              >
                <Text style={[styles.chipText, { color: theme.text }]}>
                  1:{preset}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerText: {
    fontSize: 15,
    fontWeight: "600",
  },
  headerChevron: {
    fontSize: 14,
  },
  body: {
    gap: 12,
    paddingTop: 4,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  field: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 12,
  },
  input: {
    borderRadius: 8,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  presets: {
    flexDirection: "row",
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
});
