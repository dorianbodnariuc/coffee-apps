import {
  DarkTheme,
  DefaultTheme,
  Tabs,
  ThemeProvider,
  useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, useColorScheme } from 'react-native';

import { AuthProvider } from '@/lib/auth-context';

/** Header-right gear on the History tab that pushes the settings route. */
function SettingsButton() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const color = colorScheme === 'dark' ? '#ffffff' : '#000000';

  return (
    <Pressable
      onPress={() => router.push('/settings')}
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
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Tabs>
          <Tabs.Screen name="index" options={{ title: 'Log' }} />
          <Tabs.Screen
            name="history"
            options={{
              title: 'History',
              headerRight: () => <SettingsButton />,
            }}
          />
        </Tabs>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
