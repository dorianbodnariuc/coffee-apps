# Auth Platform Matrix

How each auth method behaves across platforms, and what it takes to enable
provider-based sign-in later.

## Current state

The app ships with **email/password** auth only. It works on iOS, Android, and
web with no extra configuration. Other providers are not enabled in the
Supabase project yet — the steps below describe how to turn them on.

## Methods

| Method        | iOS | Android | Web | Notes |
| ------------- | --- | ------- | --- | ----- |
| Email/password| ✅  | ✅      | ✅  | Works everywhere, no setup |
| Google OAuth  | ✅* | ✅      | ✅  | *See Expo Go caveat below |
| Apple sign-in | ✅  | ❌      | ✅* | iOS only; *web works via OAuth, native needs a dev build |

## Key caveats

- **Apple sign-in is iOS-only** (`AppleAuthentication` is an iOS API). On
  Android the Apple provider button must be hidden.
- **Expo Go uses `exp://` redirect URLs.** `signInWithOAuth` for Google works
  in Expo Go because Google accepts the redirect. Apple requires a native
  callback URL (`com.apple.developer.applesignin`), which only works in a
  development build — not Expo Go.
- Every OAuth provider needs **client IDs** from the provider console and
  matching **redirect URLs** configured on both the provider and Supabase.

## Enabling a provider later

1. Open the **Supabase dashboard** → your project → **Authentication →
   Providers**.
2. Pick **Google** or **Apple** and toggle it on.
3. Create the provider credentials:
   - **Google:** Google Cloud Console → OAuth consent screen → create an OAuth
     client ID for iOS/Android/web (one per platform).
   - **Apple:** Apple Developer → Certificates, Identifiers & Profiles →
     register an App ID with "Sign in with Apple" enabled → create a Services
     ID (one for the app, one for web).
4. Paste the client IDs (and secret for Apple) into the Supabase provider
   form, then copy Supabase's generated **redirect URL** into the provider
   console's allowed callback URLs.
5. Add the matching `exp://` redirect URLs when testing in Expo Go, or the
   app's scheme-based URL when running a development build.
6. Add the sign-in buttons to the auth screen and gate them per platform
   (e.g. hide Apple on Android).

## Reference

- Supabase docs: "Login with Apple", "Login with Google" (Auth guides).
- Expo docs: "Sign in with Apple", `expo-auth-session` for OAuth redirects.
