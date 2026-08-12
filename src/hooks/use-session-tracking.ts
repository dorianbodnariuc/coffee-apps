import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/lib/auth-context";
import { track } from "@/lib/track";

/**
 * Fires `session_start` once per foreground while signed in (ticket T6).
 * AppState 'active' transitions fire the listener; the effect body fires the
 * initial foreground. The ref guards against double-firing within one
 * foreground (AppState can emit 'active' right after mount) and resets when
 * the signed-in user changes.
 */
export function useSessionTracking() {
  const { user } = useAuth();
  const firedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    firedRef.current = false;

    const fire = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      track("session_start");
    };

    fire();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") fire();
      else firedRef.current = false;
    });
    return () => subscription.remove();
  }, [user]);
}
