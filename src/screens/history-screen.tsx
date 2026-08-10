import { StyleSheet, Text, View } from 'react-native';

/**
 * Placeholder for the brew history list. Actual list + deletion ship in a
 * later ticket (see coffee-app-agent-plan.md).
 */
export default function HistoryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>History</Text>
      <Text style={styles.subtitle}>Saved brews will appear here.</Text>
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
