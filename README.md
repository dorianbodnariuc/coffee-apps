# coffee-app

Brew-logging app built with Expo (React Native) + TypeScript.

- **Navigation:** expo-router, two tabs — Log and History.
- **Structure, naming, and commit conventions:** see [CONVENTIONS.md](./CONVENTIONS.md).
- **Plan and ticket partition:** [coffee-app-agent-plan.md](./coffee-app-agent-plan.md).
- **Decisions & rationale:** [docs/decisions.md](./docs/decisions.md) (D-### log).

## Development

```sh
npm install
npm run start      # Expo dev server
npm run lint       # ESLint (expo lint)
npm run typecheck  # tsc --noEmit
npm run format     # Prettier
```
