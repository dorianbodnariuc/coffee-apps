import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { Radius } from "@/constants/theme";
import type { Bean } from "@/types/bean";

export type BeanPickerModalProps = {
  visible: boolean;
  beans: Bean[];
  onSelect: (bean: Bean) => void;
  onClose: () => void;
};

/**
 * Lists the user's cellar beans for soft-linking into a brew log (T9).
 * Selecting one fills the log's bean snapshot + sets bean_id.
 */
export default function BeanPickerModal({
  visible,
  beans,
  onSelect,
  onClose,
}: BeanPickerModalProps) {
  const theme = useTheme();

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <Pressable
          style={[styles.card, { backgroundColor: theme.background }]}
          onPress={() => {}}
        >
          <Text style={[styles.title, { color: theme.text }]}>Choose a bean</Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
            {beans.map((bean) => (
              <Pressable
                accessibilityRole="button"
                key={bean.id}
                onPress={() => onSelect(bean)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.rowInfo}>
                  <Text
                    style={[styles.rowTitle, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {bean.name}
                  </Text>
                  <Text
                    style={[styles.rowSub, { color: theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {[bean.roaster, bean.origin].filter(Boolean).join(" · ") ||
                      "No roaster or origin"}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    alignSelf: "center",
    borderRadius: Radius.lg,
    maxHeight: "70%",
    maxWidth: 480,
    padding: 20,
    width: "100%",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  scroll: {
    flexShrink: 1,
  },
  list: {
    gap: 8,
  },
  row: {
    borderRadius: 12,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowInfo: {
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  rowSub: {
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
  },
});
