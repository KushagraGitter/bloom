# Bloom

A private pregnancy tracker for two people: she owns the data, and her partner
gets a login that sees everything and can log on her behalf.

- Design: [Bloom pregnancy tracker canvas](https://claude.ai/artifact/NCch9gUDiFioeQTw3f1T8L)
- Plan: [Bloom build plan](https://claude.ai/artifact/Xog4TdMK4GhQhJXLhUnXPW)

## Stack

- **App:** Expo (SDK 57) + TypeScript + Expo Router, one codebase for iOS and Android
- **Data:** TanStack Query, Supabase JS client, Zustand for small UI state
- **Backend:** Supabase (Postgres with Row Level Security, Auth, Storage, Realtime)

## Layout

```
src/app/            routes (each design artboard becomes one)
  (tabs)/           Today, Meals, Vitamins, Reports, Progress
  dev/components    dev-only gallery of the shared components
src/components/     Card, Chip, Toggle, BottomSheet, TabBar, Button, Text, Screen
src/theme/tokens.ts colours, fonts, borders and shadows from the design
src/lib/            Supabase client, query client, due-date maths
supabase/
  migrations/       SQL schema and RLS policies
  tests/            RLS checks against a throwaway Postgres
```

## Run the app

```sh
npm install
cp .env.example .env.local   # then add your Supabase URL and anon key
npx expo start
```

The app still boots without Supabase keys; Today shows a "not connected" note.
Expo Go is fine for now. Once Google sign-in lands, a development build is
needed (`npx eas-cli@latest build --profile development`).

## Checks

```sh
npm run lint
npm run typecheck
npm test                 # unit tests (due-date maths)
supabase/tests/run.sh    # applies migrations to a scratch Postgres and runs the RLS checks
```

`supabase/tests/run.sh` uses the usual `PGHOST` / `PGUSER` / `PGPASSWORD`
variables and needs permission to create and drop a database. CI runs all of
these on every pull request.

## Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run each file in `supabase/migrations/` in order.
3. Copy the project URL and anon key into `.env.local`.

## Data model (phase 1)

Everything hangs off one `pregnancies` row. The owner and an invited partner are
rows in `members`, and every RLS policy checks membership, so a third account
sees nothing.

| Table            | Purpose |
| ---------------- | ------- |
| `profiles`       | One per login, created automatically on sign-up |
| `pregnancies`    | LMP date (due date is generated as LMP + 280 days), dating method, health details |
| `members`        | Who can see a pregnancy: `owner` or `partner` |
| `invites`        | 6-digit codes, valid 48 hours, single use; redeemed through `accept_invite(code)` |
| `readings`       | Weight, BP, sugar, sleep, kicks and water check-ins, stamped with who logged them |
| `reminder_prefs` | Per-person reminder settings |

Invite redemption is rate-limited to 10 attempts an hour per account.
