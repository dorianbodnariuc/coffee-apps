import { Platform, StyleSheet, Text, type TextProps } from "react-native";

import { Fonts, ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type ThemedTextProps = TextProps & {
  type?:
    | "default"
    | "title"
    | "subtitle"
    | "sectionTitle"
    | "small"
    | "smallBold"
    | "caption"
    | "link"
    | "linkPrimary"
    | "code";
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = "default", themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? "text"] },
        type === "default" && styles.default,
        type === "title" && styles.title,
        type === "subtitle" && styles.subtitle,
        type === "sectionTitle" && styles.sectionTitle,
        type === "small" && styles.small,
        type === "smallBold" && styles.smallBold,
        type === "caption" && styles.caption,
        type === "link" && styles.link,
        // linkPrimary resolves its color from the primary token at render time
        // (was a hardcoded blue that ignored light/dark).
        type === "linkPrimary" && [styles.link, styles.linkPrimary, { color: theme.primary }],
        type === "code" && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
  },
  link: {
    fontSize: 14,
    lineHeight: 20,
  },
  linkPrimary: {
    fontWeight: "600",
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: "700" }) ?? "500",
    fontSize: 12,
  },
});
