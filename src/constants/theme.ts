/**
 * Design tokens (T22). Every color in the app references these semantic
 * tokens — no raw hex outside this file. Light + dark share the same keys
 * (`ThemeColor` = their intersection).
 */

import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#000000",
    background: "#FFFFFF",
    backgroundElement: "#F0F0F3",
    backgroundSelected: "#E0E1E6",
    textSecondary: "#60646C",
    /** Brand accent — warm coffee amber. Links, primary buttons, accents. */
    primary: "#8B5E3C",
    /** Text/icon color placed ON a `primary` fill. */
    onPrimary: "#FFFFFF",
    /** Error/alert text and accents on normal backgrounds. */
    danger: "#C0392B",
    /** Text placed ON a `dangerBackground` fill. */
    dangerText: "#E57373",
    /** Destructive-action button fill (dark red). */
    dangerBackground: "#3D1A1A",
    /** Hairline / divider / input outline. */
    border: "#E0E1E6",
    /** Positive state (success messages). */
    success: "#1E7B34",
    /** Disabled control fill/text. */
    disabled: "#C7C7CC",
    /** Modal / scrim overlay. */
    overlay: "rgba(0,0,0,0.5)",
  },
  dark: {
    text: "#FFFFFF",
    background: "#000000",
    backgroundElement: "#212225",
    backgroundSelected: "#2E3135",
    textSecondary: "#B0B4BA",
    primary: "#C68B59",
    onPrimary: "#1C1C1E",
    danger: "#E57373",
    dangerText: "#E57373",
    dangerBackground: "#3D1A1A",
    border: "#2E3135",
    success: "#4CD964",
    disabled: "#48484A",
    overlay: "rgba(0,0,0,0.6)",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

/** Shared shadow/elevation for cards and floating surfaces. */
export const Elevation = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;

/** Tab bar height above the bottom edge, by platform. */
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;

/**
 * Phone-frame cap for content. On web the app renders full-bleed unless the
 * root layout constrains it to this width; native phones are already ~this
 * wide, so it's a no-op there.
 */
export const MaxContentWidth = 430;
