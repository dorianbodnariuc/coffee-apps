import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import EmptyState from "@/components/empty-state";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth-context";
import { Radius } from "@/constants/theme";

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, isConfigured, signOut, deleteAccount } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleSignOut = async () => {
    setBusy(true);
    await signOut();
    setBusy(false);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This permanently deletes your account and all your brew logs. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            const result = await deleteAccount();
            setBusy(false);
            if (result.error) {
              Alert.alert("Could not delete account", result.error);
              return;
            }
            router.back();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Pressable
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        onPress={() => router.back()}
      >
        <Text style={[styles.backText, { color: theme.text }]}>‹ Back</Text>
      </Pressable>

      {!isConfigured ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Backend not configured"
          body="Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable accounts."
        />
      ) : user ? (
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
          <Text style={[styles.email, { color: theme.textSecondary }]}>
            Signed in as {user.email}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
            onPress={handleSignOut}
            disabled={busy}
          >
            <Text style={[styles.buttonText, { color: theme.text }]}>
              {busy ? "Please wait…" : "Sign out"}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.dangerBackground },
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
            onPress={handleDeleteAccount}
            disabled={busy}
          >
            <Text style={[styles.buttonText, { color: theme.dangerText }]}>
              Delete account
            </Text>
          </Pressable>
        </View>
      ) : (
        <EmptyState
          icon="person-circle-outline"
          title="You're signed out"
          body="Sign in to sync your brews and keep your saved terms."
          actionLabel="Sign in or create an account"
          onAction={() => router.push("/auth")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
  },
  backText: {
    fontSize: 16,
  },
  content: {
    gap: 16,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  email: {
    fontSize: 14,
  },
  button: {
    alignItems: "center",
    borderRadius: Radius.md,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
