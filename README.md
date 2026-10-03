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
  (auth)/           welcome and Google sign-in
  onboarding.tsx    7 setup questions, or join a partner's pregnancy by code
  (tabs)/           Today (check-ins, kicks, water, tools, vitamins, next appointment) and Vitamins; Meals, Reports and Progress are placeholders
  appointments.tsx  month calendar, what is coming up, book and cancel appointments
  profile.tsx       edit details, reminders, units, partner invite code
  dev/components    dev-only gallery of the shared components
src/components/     Card, Chip, Toggle, BottomSheet, TabBar, Button, Text, Screen, date and time fields
src/theme/tokens.ts colours, fonts, borders and shadows from the design
src/lib/            Supabase client, auth, session, data hooks, readings, profile fields, due-date maths, reminders
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

Without Supabase keys the app still opens on the welcome screen, and sign-in
explains what is missing. Expo Go is enough to run it.

## Checks

```sh
npm run lint
npm run typecheck
npm test                 # unit and screen tests
supabase/tests/run.sh    # applies migrations to a scratch Postgres and runs the RLS checks
```

`supabase/tests/run.sh` uses the usual `PGHOST` / `PGUSER` / `PGPASSWORD`
variables and needs permission to create and drop a database. CI runs all of
these on every pull request.

## Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run each file in `supabase/migrations/` in order.
   Later pull requests add new files there: run only the ones you haven't run yet,
   oldest first.
3. Copy the project URL and publishable (or anon) key into `.env.local`.
4. Google sign-in: create a Web OAuth client in Google Cloud and enter its
   client ID and secret under Authentication → Providers → Google. Add
   `https://<project-ref>.supabase.co/auth/v1/callback` as an authorised
   redirect URI on the Google client.
5. Under Authentication → URL Configuration → Redirect URLs, add `bloom://**`
   (builds), `exp://**` (Expo Go) and `http://localhost:8081/**` (web dev).

The app signs in through Supabase's hosted Google page in an in-app browser,
so it needs no Google IDs itself and works in Expo Go.

## Data model

Everything hangs off one `pregnancies` row. The owner and an invited partner are
rows in `members`, and every RLS policy checks membership, so a third account
sees nothing.

| Table            | Purpose |
| ---------------- | ------- |
| `profiles`       | One per login, created automatically on sign-up |
| `pregnancies`    | LMP date (due date is generated as LMP + 280 days), dating method, health details |
| `members`        | Who can see a pregnancy: `owner` or `partner` |
| `invites`        | 6-digit codes, valid 48 hours, single use, one unused code per pregnancy; made by `new_invite(pregnancy)`, redeemed through `accept_invite(code)` |
| `readings`       | Weight, BP, sugar, sleep, kicks and water check-ins, stamped with who logged them |
| `reminder_prefs` | Per-person reminder settings |
| `medications`    | What she takes: name, dose, morning / afternoon / evening, and the first and last day it is due |
| `med_doses`      | One row per medicine per day it was ticked off, stamped with who ticked it; the streak is worked out from these |
| `appointments`   | Scans, check-ups and tests: a title, a day, and optionally a clock time and a place. The day and time are kept as typed, not as a UTC moment, so "9:00" reads the same on both phones |

Invite redemption is rate-limited to 10 attempts an hour per account.

Readings, medications, doses and appointments are in Supabase's Realtime publication,
so a tick, a kick or a booking on one phone shows up on the other. The app listens on one channel per
pregnancy (`useRealtimeSync`, mounted once in the tabs layout).

## Reminders

Reminders are local notifications that each phone schedules for itself, so they
need no server and keep working offline. Which ones a person gets follows their
own switches on Profile (`reminder_prefs`); a switch they never touched counts
as on.

| Reminder     | When |
| ------------ | ---- |
| Vitamins     | 8 am, 2 pm and 9 pm for the morning, afternoon and evening medicines, for today and the next 6 days. It names what is still to take and skips a dose that is already ticked off |
| Drink water  | Every day at 9, 11, 1, 3, 5 and 7 |
| Kick counts  | Every day at 8 pm, from week 28 |
| Appointments | A day before at the same time of day (9 am when there is no time) and 2 hours before, for appointments in the next 60 days |

The times are constants at the top of `src/lib/reminders.ts`, beside
`planReminders`, a plain function that works out what should be scheduled (and
the part the unit tests cover most). `src/lib/notifications.ts` replaces what the
phone has scheduled, and `useReminders` (mounted once, in the root layout) keeps
the two in step after a switch, a tick, a booking, a new day or coming back to
the app.

Good to know:

- The phone asks for permission the first time any reminder is on. If it was
  turned down, Profile says so and opens the phone's settings.
- Vitamin and appointment reminders are scheduled a week and two months ahead,
  so the app needs opening now and then (every few days is plenty) to keep
  them topped up. Water and kick reminders repeat on their own.
- A phone only updates its reminders while the app is open, so a dose ticked on
  the other phone is noticed the next time this app is opened; until then the
  reminder still arrives.
- Signing out, or being removed from the pregnancy, clears a phone's reminders
  the next time Bloom opens and sees it. Until then a removed partner's phone
  keeps what it already had scheduled: up to a week of vitamin reminders and any
  appointments, which name the medicines and the appointment. A phone that opens
  with no sign-in at all (offline, with the old one out of date) keeps its
  reminders too, so a bad connection never wipes them.
- Reminders name medicines and appointments, so they show on a locked phone
  unless iOS's Show Previews setting hides them. There is no "hide details"
  switch yet.
- The vitamin times are fixed for each slot (8 am, 2 pm, 9 pm).
  `reminder_prefs.times` exists for custom times but nothing reads it yet.
- An iPhone keeps only its 64 soonest notifications, so no more than 60 are
  scheduled; the furthest-away ones are added as the nearer ones pass.
- On the web there is nothing to schedule, so reminders do nothing there.
- On Android the status-bar icon is the template's monochrome glyph
  (`assets/android-icon-monochrome.png`) tinted purple; swap in a Bloom glyph
  when there is one. It only shows in a development or EAS build, not Expo Go.
- The `expo-notifications` plugin adds iOS's push entitlement (`aps-environment`)
  to any native build, even though these reminders are local. EAS builds need
  the paid Apple Developer account anyway, but a free Apple ID can't sign an app
  that has it. Expo Go is unaffected.
- In a development build, Expo Go included, Profile shows "Send a test
  reminder", which sends one 5 seconds later.
