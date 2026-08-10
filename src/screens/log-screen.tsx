import { StyleSheet, Text, View } from 'react-native';

/**
 * Placeholder for the brew-logging form. Actual form fields ship in a later
 * ticket (see coffee-app-agent-plan.md).
 */
export default function LogScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log</Text>
      <Text style={styles.subtitle}>Brew logging lands in a later ticket.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
});
