import { DarkTheme, DefaultTheme, Tabs, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Tabs>
        <Tabs.Screen name="index" options={{ title: 'Log' }} />
        <Tabs.Screen name="history" options={{ title: 'History' }} />
      </Tabs>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
