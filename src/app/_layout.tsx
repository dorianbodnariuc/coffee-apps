import { Ionicons } from "@expo/vector-icons";
import {
  DarkTheme,
  DefaultTheme,
  Tabs,
  ThemeProvider,
  useRouter,
} from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { Platform, Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { useSessionTracking } from "@/hooks/use-session-tracking";
import { useTheme } from "@/hooks/use-theme";
import { Colors, MaxContentWidth } from "@/constants/theme";

/** Fires session_start on foreground (T6); rendered inside AuthProvider. */
function SessionTracking() {
  useSessionTracking();
  return null;
}

/** Header-right gear on the History tab that pushes the settings route. */
function SettingsButton() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => router.push("/settings")}
      hitSlop={12}
      accessibilityLabel="Settings"
      style={styles.headerButton}
    >
      <Ionicons name="settings-outline" size={22} color={theme.text} />
    </Pressable>
  );
}

/** Header-right "Sign in" link shown on tabs when signed out (T8). */
function SignInButton() {
  const router = useRouter();
  const theme = useTheme();
  const { user, loading, isConfigured } = useAuth();

  if (loading || user || !isConfigured) return null;

  return (
    <Pressable
      onPress={() => router.push("/auth")}
      hitSlop={12}
      accessibilityLabel="Sign in"
      style={styles.headerButton}
    >
      <Text style={[styles.headerLink, { color: theme.primary }]}>Sign in</Text>
    </Pressable>
  );
}

const TAB_ICONS = {
  index: { focused: "cafe", idle: "cafe-outline" },
  history: { focused: "time", idle: "time-outline" },
  dictionary: { focused: "book", idle: "book-outline" },
} as const;

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? Colors.dark : Colors.light;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SessionTracking />
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <View style={styles.appFrame}>
            <Tabs
              screenOptions={{
                // react-navigation-web gives the label a fixed 10px height +
                // overflow:hidden AND flex-shrinks it against the 28px icon in
                // the 48px item, shearing g/y descenders ("Loa"). Give the bar
                // enough height (icon 28 + label 14 + padding) and pin the label.
                tabBarLabelStyle: { fontSize: 11, lineHeight: 14, height: 14 },
                tabBarStyle: { height: 56 },
                tabBarActiveTintColor: theme.primary,
                tabBarInactiveTintColor: theme.textSecondary,
              }}
            >
              <Tabs.Screen
                name="index"
                options={{
                  title: "Log",
                  headerRight: () => <SignInButton />,
                  tabBarIcon: ({ color, focused }) => (
                    <Ionicons
                      name={
                        focused
                          ? TAB_ICONS.index.focused
                          : TAB_ICONS.index.idle
                      }
                      size={24}
                      color={color}
                    />
                  ),
                }}
              />
              <Tabs.Screen
                name="history"
                options={{
                  title: "History",
                  headerRight: () => <SettingsButton />,
                  tabBarIcon: ({ color, focused }) => (
                    <Ionicons
                      name={
                        focused
                          ? TAB_ICONS.history.focused
                          : TAB_ICONS.history.idle
                      }
                      size={24}
                      color={color}
                    />
                  ),
                }}
              />
              <Tabs.Screen
                name="dictionary"
                options={{
                  title: "Dictionary",
                  headerRight: () => <SignInButton />,
                  tabBarIcon: ({ color, focused }) => (
                    <Ionicons
                      name={
                        focused
                          ? TAB_ICONS.dictionary.focused
                          : TAB_ICONS.dictionary.idle
                      }
                      size={24}
                      color={color}
                    />
                  ),
                }}
              />
              {/* Non-tab routes: reachable by URL, hidden from the tab bar. */}
              <Tabs.Screen
                name="auth"
                options={{ href: null, title: "Sign in" }}
              />
              <Tabs.Screen
                name="settings"
                options={{ href: null, headerShown: false }}
              />
              <Tabs.Screen
                name="brew/[id]"
                options={{ href: null, headerShown: false }}
              />
            </Tabs>
          </View>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  appFrame: {
    alignSelf: "center",
    flex: 1,
    maxWidth: Platform.OS === "web" ? MaxContentWidth : undefined,
    width: "100%",
  },
  headerButton: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
  },
  headerLink: {
    fontSize: 15,
    fontWeight: "600",
  },
});
