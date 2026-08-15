import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import EmptyState from "@/components/empty-state";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth-context";

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

function validateEmail(email: string): string | null {
  if (!EMAIL_PATTERN.test(email.trim())) return "Enter a valid email address";
  return null;
}

function validatePassword(password: string): string | null {
  if (password.length < 6) return "Password must be at least 6 characters";
  return null;
}

export default function AuthScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { isConfigured, signIn, signUp } = useAuth();
  const { term } = useLocalSearchParams<{ term?: string }>();

  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const finish = () => {
    // T17 return-to-term contract: the auth screen was reached from a term's
    // save button (signed out). Send the user back to the dictionary with the
    // term selected so its modal reopens. The term is NOT auto-saved.
    if (term) {
      router.replace({ pathname: "/dictionary", params: { term } });
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const handleSubmit = async () => {
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const result =
        mode === "signIn"
          ? await signIn(email.trim(), password)
          : await signUp(email.trim(), password);
      if (result.error) {
        setError(result.error);
        return;
      }
      finish();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isConfigured) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Backend not configured"
          body="Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable accounts."
        />
      </View>
    );
  }

  const isSignIn = mode === "signIn";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>
          {isSignIn ? "Welcome back" : "Create your account"}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {isSignIn
            ? term
              ? "Sign in to save this term."
              : "Sign in to keep your brews in sync."
            : "Free — your brews sync to your account."}
        </Text>

        <TextInput
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.backgroundElement },
          ]}
          placeholder="Email"
          placeholderTextColor={theme.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          editable={!submitting}
        />

        <TextInput
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.backgroundElement },
          ]}
          placeholder="Password"
          placeholderTextColor={theme.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          editable={!submitting}
        />

        {error ? (
          <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.primary },
            pressed && styles.buttonPressed,
            submitting && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>
            {submitting
              ? "Please wait…"
              : isSignIn
                ? "Sign in"
                : "Create account"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            setMode(isSignIn ? "signUp" : "signIn");
            setError(null);
          }}
          disabled={submitting}
        >
          <Text style={[styles.switchText, { color: theme.textSecondary }]}>
            {isSignIn
              ? "New here? Create an account"
              : "Already have an account? Sign in"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    gap: 12,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  input: {
    borderRadius: 10,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: {
    fontSize: 13,
  },
  button: {
    alignItems: "center",
    borderRadius: 10,
    justifyContent: "center",
    marginTop: 4,
    minHeight: 48,
    paddingVertical: 14,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  switchText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  messageBox: {
    flex: 1,
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  messageBody: {
    fontSize: 14,
    lineHeight: 20,
  },
});
