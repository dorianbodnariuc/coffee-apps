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

import { AuthProvider } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";

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

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <Tabs>
            <Tabs.Screen name="index" options={{ title: "Log" }} />
            <Tabs.Screen
              name="history"
              options={{
                title: "History",
                headerRight: () => <SettingsButton />,
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
