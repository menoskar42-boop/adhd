# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

pnpm workspace (Node 24, TypeScript 5.9). The repo holds three apps and a shared API toolchain:

- `artifacts/neuropilot/` — web app, Vite + React 19, Wouter, Radix UI, Tailwind v4
- `artifacts/neuropilot-mobile/` — Expo (SDK 54) + React Native, Expo Router, AsyncStorage
- `artifacts/api-server/` — Express 5, esbuild CJS bundle, Pino
- `lib/db/` — Drizzle ORM + PostgreSQL schema (`@workspace/db`)
- `lib/api-spec/` — OpenAPI source of truth (`openapi.yaml`) consumed by Orval
- `lib/api-zod/`, `lib/api-client-react/` — generated outputs from the spec

`react` / `react-dom` are pinned to `19.1.0` in the catalog because Expo requires that exact version. The `catalog:` keyword in `package.json` files refers to versions defined in `pnpm-workspace.yaml`.

## Commands

Workspace-wide (run from repo root):

- `pnpm run typecheck` — typecheck every package
- `pnpm run build` — typecheck + build all
- `pnpm install --frozen-lockfile` — install (also run by `scripts/post-merge.sh` after every merge, which then runs `pnpm --filter db push`)

Per-package (use `pnpm --filter <name> run <script>`):

- API spec → client codegen: `pnpm --filter @workspace/api-spec run codegen` (regenerates `lib/api-zod` and `lib/api-client-react` from `openapi.yaml`; runs `typecheck:libs` after).
- DB schema push (dev only): `pnpm --filter @workspace/db run push` (or `push-force`).
- API server dev: `pnpm --filter @workspace/api-server run dev`.
- Web dev / build: `pnpm --filter @workspace/neuropilot run dev|build|serve`.
- Mobile dev: `pnpm --filter @workspace/neuropilot-mobile run dev` (uses Replit-specific env vars to start Expo on `$PORT`).

There is no test runner configured. `next lint` referenced in the orphan top-level `package.json` is not the active toolchain — see "Orphan files" below.

## Architecture

### API contract flow

`lib/api-spec/openapi.yaml` is the single source of truth. Orval generates two consumers:

1. `@workspace/api-zod` — request/response Zod schemas, used by `api-server` for validation.
2. `@workspace/api-client-react` — typed React Query hooks, consumed by both `neuropilot` (web) and `neuropilot-mobile`.

Whenever the OpenAPI spec changes, run `codegen` before touching server or client code; the typecheck step at the end of codegen will fail if the spec and consumers drift.

### Mobile-specific architecture (geofence reminders)

The mobile app is the only place geofencing exists. Key invariants:

- The background geofence task is registered **at module load** via `import "@/lib/geofence"` in `artifacts/neuropilot-mobile/app/_layout.tsx`. Removing that import silently disables location reminders.
- Geofencing uses `expo-task-manager` + `expo-location.startGeofencingAsync`; reminders fire through `expo-notifications`.
- Lifecycle: geofence is **started** when `addTask` runs with a linked place and **stopped** in `finishTask` / `clearTask`. Anything that mutates the active task must keep this paired.
- "Always Allow" background location permission is required; the app surfaces an alert when it isn't granted.
- `expo-notifications` (0.31.5) and `expo-task-manager` (12.0.6) are pinned to SDK 54-compatible releases — bump deliberately.
- The places list screen polls every 2s in `app/places.tsx`; there is no shared state/event bus between it and `index.tsx`.

### Storage model

Mobile stores task and saved places entirely in AsyncStorage (`artifacts/neuropilot-mobile/lib/storage.ts`, `places.ts`) — no backend round-trip for the focus loop. Web uses browser `localStorage` plus the Notification API for nudges.

## Conventions

- **Brand colors** (used in both web and mobile): bg `#F5F7F6`, primary `#4A6FA5`, accent `#7FB069`, text `#2E2E2E`, running-state bg `#EAF1EC`. Mobile uses Inter (400/500/600/700).
- **Notification copy** for mobile and place-related labels are **Arabic strings** by product decision — preserve when editing UI text in `app/places.tsx` / `lib/geofence.ts`.
- Zod is imported as `zod/v4` (Zod 4 path), not `zod`, in API code.

## Supply-chain guard

`pnpm-workspace.yaml` sets `minimumReleaseAge: 1440` (1 day). Do not lower this. To install a freshly-released package, add it to `minimumReleaseAgeExclude` and remove the entry once the window passes.

## Orphan files (do not edit)

The repo root contains leftovers from the pre-monorepo Next.js scaffold: `package.json` (declares `next dev|build|lint`), `app/`, `next.config.mjs`, `tailwind.config.js`, `tsconfig.json` references that don't match the active layout. Backups of the same era live in `.migration-backup/`. The active web app is `artifacts/neuropilot/` (Vite). Treat root-level `app/`, `lib/storage.js`, `lib/theme.js`, `next.config.mjs`, and the root `package.json` as legacy — changes belong in `artifacts/neuropilot/src/` or `artifacts/neuropilot-mobile/` instead.

## Pointers

- Replit run/deploy config: `.replit` (autoscale deploy, post-merge hook runs `scripts/post-merge.sh`).
- Product/architecture notes maintained alongside this file: `replit.md`.
