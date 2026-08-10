import { StyleSheet, Text, View } from 'react-native';
import { BREW_METHODS, RATING_SCALE, RATIO_PRESETS } from '@/constants';

/**
 * Placeholder for the brew-logging form. Actual form fields ship in a later
 * ticket (see coffee-app-agent-plan.md).
 */
export default function LogScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log</Text>
      <Text style={styles.subtitle}>Brew logging lands in a later ticket.</Text>
      <Text style={styles.preview}>
        {BREW_METHODS.length} methods · rating {RATING_SCALE[0]}–{RATING_SCALE[RATING_SCALE.length - 1]} in 0.5
        steps · presets 1:{RATIO_PRESETS.join(' / 1:')}
      </Text>
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
  preview: {
    fontSize: 12,
    opacity: 0.5,
    textAlign: 'center',
    marginTop: 8,
  },
});
