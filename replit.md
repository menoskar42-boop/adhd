# NeuroPilot — ADHD-focused one-task timer app (web + mobile)

## Run & Operate
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Stack
- **Monorepo**: pnpm workspaces, Node.js 24, TypeScript 5.9
- **Web app**: Vite + React (`artifacts/neuropilot/`), preview path `/`
- **Mobile app**: Expo + React Native (`artifacts/neuropilot-mobile/`), preview path `/mobile/`
- **API**: Express 5 + PostgreSQL + Drizzle ORM + Zod (`zod/v4`)
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Where things live
- Web app: `artifacts/neuropilot/src/`
- Mobile app: `artifacts/neuropilot-mobile/app/` (Expo Router screens), `lib/` (storage, places, geofence)
- API server: `artifacts/api-server/`
- DB schema: `packages/db/src/schema.ts`

## Architecture decisions
- Mobile uses AsyncStorage for all local state (task + places) — no backend needed
- Geofencing via `expo-task-manager` + `expo-location` `startGeofencingAsync`; notifications via `expo-notifications`
- Background geofence task registered at module load in `_layout.tsx` via `import "@/lib/geofence"`
- Geofence is started on `addTask` (if a place is linked) and stopped in `finishTask`/`clearTask`
- Web app uses browser Notification API for reminder nudges; mobile uses local push notifications

## Product
- **Web**: Single-task focus timer with session-length slider, "Change Task" flow, and in-browser reminder nudges
- **Mobile**: Mirror of web with haptics, Inter font, brand colors, and geofence-based location reminders
- **Location reminders** (mobile only): Users save named places (Home, Work, etc.) via GPS capture, link a place to a task, and get a local notification when they physically arrive at that place

## User preferences
- Arabic UI strings for notification bodies and place-related labels
- Brand colors: bg `#F5F7F6`, primary `#4A6FA5`, accent `#7FB069`, text `#2E2E2E`, running bg `#EAF1EC`
- Inter font family (400/500/600/700) throughout mobile app

## Gotchas
- Geofencing requires background location permission ("Always Allow") — app alerts user if not granted
- `expo-notifications` and `expo-task-manager` versions pinned to SDK 54-compatible releases (0.31.5 and 12.0.6)
- Places screen reloads on a 2-second poll interval in `index.tsx` (no shared state / event bus)

## Pointers
- Expo mobile skill: `.local/skills/expo/SKILL.md`
- pnpm workspace skill: `.local/skills/pnpm-workspace/SKILL.md`
