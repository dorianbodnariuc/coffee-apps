import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth-context";

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
        <View style={styles.messageBox}>
          <Text style={[styles.title, { color: theme.text }]}>
            Backend not configured
          </Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to
            enable accounts.
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

          {user ? (
            <Text style={[styles.email, { color: theme.textSecondary }]}>
              Signed in as {user.email}
            </Text>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => router.push("/auth")}
            >
              <Text style={[styles.rowText, { color: theme.text }]}>
                Signed out
              </Text>
              <Text style={[styles.rowHint, { color: theme.textSecondary }]}>
                Sign in or create an account
              </Text>
            </Pressable>
          )}

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

          {user ? (
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.dangerButton,
                pressed && styles.pressed,
                busy && styles.disabled,
              ]}
              onPress={handleDeleteAccount}
              disabled={busy}
            >
              <Text style={[styles.buttonText, styles.dangerText]}>
                Delete account
              </Text>
            </Pressable>
          ) : null}
        </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  row: {
    borderRadius: 10,
    gap: 2,
    paddingVertical: 8,
  },
  rowText: {
    fontSize: 16,
    fontWeight: "600",
  },
  rowHint: {
    fontSize: 13,
  },
  button: {
    alignItems: "center",
    borderRadius: 10,
    paddingVertical: 14,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  dangerButton: {
    backgroundColor: "#3D1A1A",
  },
  dangerText: {
    color: "#E57373",
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
  messageBox: {
    gap: 8,
    paddingHorizontal: 24,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
});
