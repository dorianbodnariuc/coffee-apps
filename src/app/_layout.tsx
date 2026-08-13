import {
  DarkTheme,
  DefaultTheme,
  Tabs,
  ThemeProvider,
  useRouter,
} from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { Pressable, Text, useColorScheme } from "react-native";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { useSessionTracking } from "@/hooks/use-session-tracking";

/** Fires session_start on foreground (T6); rendered inside AuthProvider. */
function SessionTracking() {
  useSessionTracking();
  return null;
}

/** Header-right gear on the History tab that pushes the settings route. */
function SettingsButton() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const color = colorScheme === "dark" ? "#ffffff" : "#000000";

  return (
    <Pressable
      onPress={() => router.push("/settings")}
      hitSlop={8}
      accessibilityLabel="Settings"
    >
      <Text style={{ color, fontSize: 18, paddingRight: 16 }}>⚙</Text>
    </Pressable>
  );
}

/** Header-right "Sign in" link shown on tabs when signed out (T8). */
function SignInButton() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const color = colorScheme === "dark" ? "#ffffff" : "#000000";
  const { user, loading, isConfigured } = useAuth();

  if (loading || user || !isConfigured) return null;

  return (
    <Pressable
      onPress={() => router.push("/auth")}
      hitSlop={8}
      accessibilityLabel="Sign in"
    >
      <Text
        style={{ color, fontSize: 15, fontWeight: "600", paddingRight: 16 }}
      >
        Sign in
      </Text>
    </Pressable>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SessionTracking />
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <Tabs>
            <Tabs.Screen
              name="index"
              options={{ title: "Log", headerRight: () => <SignInButton /> }}
            />
            <Tabs.Screen
              name="history"
              options={{
                title: "History",
                headerRight: () => <SettingsButton />,
              }}
            />
            <Tabs.Screen
              name="dictionary"
              options={{
                title: "Dictionary",
                headerRight: () => <SignInButton />,
              }}
            />
            {/* Non-tab routes: reachable by URL, hidden from the tab bar. */}
            <Tabs.Screen name="auth" options={{ href: null }} />
            <Tabs.Screen name="settings" options={{ href: null }} />
            <Tabs.Screen
              name="brew/[id]"
              options={{ href: null, headerShown: false }}
            />
          </Tabs>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
