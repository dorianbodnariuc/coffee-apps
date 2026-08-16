import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import BeanFormModal from "@/components/bean-form-modal";
import EmptyState from "@/components/empty-state";
import { useBeans, useCreateBean, useDeleteBean, useUpdateBean } from "@/hooks/use-beans";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/hooks/use-theme";
import { freshnessBadge, type FreshnessLevel } from "@/lib/freshness";
import type { Bean } from "@/types/bean";

const LEVEL_COLOR: Record<
  FreshnessLevel,
  keyof ReturnType<typeof useTheme>
> = { green: "success", amber: "warning", red: "danger" };

/**
 * Cellar tab (T9): the user's beans with roast-date freshness badges, plus
 * add/edit/delete. Deleting a bean never mutates brew-log history (FK set null).
 */
export default function CellarScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, isConfigured } = useAuth();
  const userId = user?.id ?? null;

  const { data: beans, isLoading, isError, refetch } = useBeans(userId);
  const createMutation = useCreateBean(userId ?? "");
  const updateMutation = useUpdateBean(userId ?? "");
  const deleteMutation = useDeleteBean(userId ?? "");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Bean | null>(null);

  if (!isConfigured || !user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <EmptyState
          icon="basket-outline"
          title="Sign in to use your cellar"
          body="Track the beans you own and how fresh they are."
          actionLabel="Sign in"
          onAction={() => router.push("/auth")}
        />
      </View>
    );
  }

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (bean: Bean) => {
    setEditing(bean);
    setFormOpen(true);
  };
  const closeForm = () => setFormOpen(false);

  const suggestedBeanNames = Array.from(
    new Set((beans ?? []).map((bean) => bean.name)),
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {isLoading ? (
        <ActivityIndicator color={theme.textSecondary} style={styles.spinner} />
      ) : isError ? (
        <EmptyState
          icon="refresh-outline"
          title="Could not load your beans"
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      ) : beans && beans.length === 0 ? (
        <EmptyState
          icon="basket-outline"
          title="No beans yet"
          body="Add the beans you're brewing to track their freshness."
          actionLabel="Add a bean"
          onAction={openCreate}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {(beans ?? []).map((bean) => (
            <BeanRow
              key={bean.id}
              bean={bean}
              theme={theme}
              onPress={() => openEdit(bean)}
            />
          ))}
        </ScrollView>
      )}

      {beans && beans.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add bean"
          onPress={openCreate}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: theme.primary },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="add" size={26} color={theme.onPrimary} />
        </Pressable>
      ) : null}

      {formOpen ? (
        <BeanFormModal
          key={editing?.id ?? "new"}
          initial={editing}
          busy={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}
          onClose={closeForm}
          suggestedBeanNames={suggestedBeanNames}
          onSubmit={(input) => {
            if (editing) {
              updateMutation.mutate(
                { id: editing.id, input },
                { onSuccess: closeForm },
              );
            } else {
              createMutation.mutate(input, { onSuccess: closeForm });
            }
          }}
          onDelete={
            editing
              ? () => deleteMutation.mutate(editing.id, { onSuccess: closeForm })
              : undefined
          }
        />
      ) : null}
    </View>
  );
}

function BeanRow({
  bean,
  theme,
  onPress,
}: {
  bean: Bean;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
}) {
  const badge = freshnessBadge(bean.roastDate);
  const badgeColor = badge ? theme[LEVEL_COLOR[badge.level]] : theme.textSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.rowInfo}>
        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
          {bean.name}
        </Text>
        <Text
          style={[styles.rowSub, { color: theme.textSecondary }]}
          numberOfLines={1}
        >
          {[bean.roaster, bean.origin].filter(Boolean).join(" · ") || "No roaster or origin"}
        </Text>
      </View>
      {badge ? (
        <View style={styles.badge}>
          <View style={[styles.badgeDot, { backgroundColor: badgeColor }]} />
          <Text style={[styles.badgeText, { color: badgeColor }]}>
            {badge.label}
          </Text>
        </View>
      ) : (
        <Text style={[styles.rowSub, { color: theme.textSecondary }]}>—</Text>
      )}
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  spinner: {
    marginTop: 48,
  },
  list: {
    gap: 8,
    padding: 16,
    paddingBottom: 96,
  },
  row: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  rowSub: {
    fontSize: 13,
  },
  badge: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  badgeDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  fab: {
    alignItems: "center",
    borderRadius: 28,
    bottom: 16,
    height: 56,
    justifyContent: "center",
    position: "absolute",
    right: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    width: 56,
    elevation: 4,
  },
  pressed: {
    opacity: 0.7,
  },
});
