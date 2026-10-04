# Bloom

A private pregnancy tracker for two people: she owns the data, and her partner
gets a login that sees everything and can log on her behalf.

- Design: [Bloom pregnancy tracker canvas](https://claude.ai/artifact/NCch9gUDiFioeQTw3f1T8L)
- Plan: [Bloom build plan](https://claude.ai/artifact/Xog4TdMK4GhQhJXLhUnXPW)

## Stack

- **App:** Expo (SDK 57) + TypeScript + Expo Router, one codebase for iOS and Android
- **Data:** TanStack Query, Supabase JS client, Zustand for small UI state
- **Backend:** Supabase (Postgres with Row Level Security, Auth, Storage, Realtime, one Edge Function)
- **AI:** Claude, called only from the `scan` Edge Function, so no AI key is ever in the app

## Layout

```
src/app/            routes (each design artboard becomes one)
  (auth)/           welcome and Google sign-in
  onboarding.tsx    7 setup questions, or join a partner's pregnancy by code
  (tabs)/           Today (check-ins, kicks, water, tools, vitamins, next appointment), Meals, Vitamins, Reports (reports read by AI and checked before saving, questions for the next visit) and Progress (weekly charts, 7-day averages, bump diary)
  appointments.tsx  month calendar, what is coming up, book and cancel appointments
  mood.tsx          mood, symptoms and a note, saved as entries with a history (opened from Today's tools)
  contractions.tsx  contraction timer: lengths, gaps and counts per session, earlier sessions, her own "when to call" notes
  profile.tsx       edit details, reminders, units, partner invite code
  household-key.tsx show the household key as a QR code or recovery phrase, or take it on a new phone
  dev/components    dev-only gallery of the shared components
src/components/     Card, Chip, Toggle, BottomSheet, TabBar, Button, Text, Screen, date and time fields, VaultGate (what a screen on the phone's records shows until they are open)
src/theme/tokens.ts colours, fonts, borders and shadows from the design
src/lib/            Supabase client, auth, session, data hooks, readings, profile fields, due-date maths, reminders
  vault/            on-phone record store, encryption, household key and encrypted sync
supabase/
  migrations/       SQL schema and RLS policies
  functions/scan/   Edge Function that sends a report to Claude and returns what it read
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

The app no longer reads or writes the health columns of `pregnancies` or the
`readings`, `medications`, `med_doses` and `appointments` tables: that data is in
the vault (see "Health data on the phone" below). The tables stay until the
household's data has been copied over and they are emptied by hand.

## Meals

Meals keeps its data in the phone's own store (see "Health data on the phone"
below), so what is typed in never reaches Supabase in a readable form and there
is no `meals` table. There are three kinds of record, all sealed like any other
(`src/lib/meals.ts` has their shapes and the parsing, `src/lib/useMeals.ts` the
hooks):

| Kind         | What it holds |
| ------------ | ------------- |
| `meal`       | One per thing eaten: the day, breakfast / snack / lunch / dinner, an optional time, what it was, notes, any nutrient numbers, and who logged it |
| `meal-goals` | One per household: the five daily goals the bars measure against. Its id comes from the pregnancy id (`stableId`), so both phones write the same record and the newest edit wins |
| `craving`    | One per craving or aversion; adding one that is already there, in any case, does nothing |

Good to know:

- Calories and the five nutrients (protein, iron, calcium, folate, fibre) are
  typed in by hand and all optional. The bars add up only what was entered, and
  say so when nothing has been. There is no photo or AI step yet: "Snap your
  plate" and "Use a photo" from the design wait for the scanning phase, which is
  still an open question.
- The goals start as the numbers in the design (71 g protein, 27 mg iron,
  1,000 mg calcium, 600 mcg folate, 28 g fibre). They are common starting
  targets, not advice, and the screen says so. Either of you can enter the ones
  her doctor gave her, and both phones then use those.
- The add sheet starts on the usual meal for the time of day (breakfast before
  11, lunch before 4, a snack before 6, dinner after), or on a snack when that
  meal is already logged today.
- The day is the phone's own, and moves on at midnight or when the app comes back
  to the front.
- Until a phone has the household key, or on the web, which has no on-phone
  database, Meals says so (`VaultGate`) and, on a phone, points to Household
  key. Nothing is read or written until the phone is ready.

The next screens on the store (Progress, Mood and symptoms) can reuse what Meals
is built from: `src/lib/vault/records.ts` for reading (`useVaultQuery`), saving
and removing records and making their ids, `VaultGate` for a phone that is not
ready, and `TimeField` for an optional time.

## Reports and AI scanning

Reports keeps blood tests, scans and doctors' notes, and a list of questions for
the next visit. Like Meals, both are vault records (`report` and `question`), so
nothing typed or read reaches Supabase in a readable form. `src/lib/reports.ts`
has the shapes, `src/lib/scan.ts` picks and sends the file, and
`src/lib/useReports.ts` has the hooks.

How a scan works:

1. She takes a photo, picks one, or picks a PDF (up to 10 MB). A photo is shrunk
   on the phone to the size Claude reads (1568 px on the long edge).
2. The app sends it to the `scan` Edge Function with her pregnancy week.
3. The function checks she is signed in and a member of the household, takes one
   scan from the day's allowance (`claim_scan`, 50 a day per household), and sends
   the file to Claude with a fixed JSON shape (structured outputs). The prompt
   says to copy only what is printed, leave out what can't be read and list it
   instead, use only the ranges printed on the report, and never diagnose or
   advise.
4. The draft comes back to the review sheet ("Filled by AI · check & edit"). She
   can rename it, change the type, week and lab, correct or remove any value and
   add her own. Nothing is saved until she taps Save report.

The file is never stored: not in Supabase, not in the vault, and the function
doesn't log it. Only the file's name is kept with the report. The function sends
it to the Anthropic API, which handles it under Anthropic's API data terms.

If a scan can't be done (no connection, the day's scans used up, the function not
deployed yet, or the AI couldn't read it) the sheet says so and offers to fill
the report in by hand.

Good to know:

- Values show the lab's own printed range and whether the report itself marks
  them. Bloom never labels a result normal or abnormal, and every AI summary
  carries "Not a diagnosis. Go over results with your doctor."
- The week is worked out from the date printed on the report when there is one.
- Only lab and scan reports are scanned for now. Prescription scanning (into
  Vitamins) and meal photos ("Snap your plate") can reuse the same function later.

### Set up the scan function

1. Run `supabase/migrations/20261004120000_scan_usage.sql` (the daily allowance).
2. Add the secret `ANTHROPIC_API_KEY` under Edge Functions → Secrets. Optional:
   `SCAN_MODEL` (default `claude-sonnet-5-5`) and `SCAN_DAILY_LIMIT` (default 50).
3. Deploy: `npx supabase functions deploy scan` (keep JWT verification on).

Until it is deployed, the app says AI reading isn't switched on yet and reports
can still be added by hand. `npm test` covers the function's logic
(`supabase/functions/scan/handler.ts`); `index.ts` is the Deno entry point.

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

## Health data on the phone

Health data is moving off Supabase's readable tables and onto the phones
(see the plan doc, option B). The pieces in `src/lib/vault/`:

- `localStore.ts`: every record lives in SQLite on the phone (`expo-sqlite`), and that is what screens read.
- `crypto.ts`: records are sealed with XChaCha20-Poly1305 under a 32-byte household key, bound to their household and id.
- `keys.ts`: the key sits in the phone's keychain (`expo-secure-store`) and can be written out as a recovery phrase with a checksum.
- `sync.ts` and `useVaultSync.ts`: phones upload sealed records to `vault_records` and pull the other phone's. The newest edit of a record wins, deletes travel as sealed tombstones, and a realtime change on `vault_records` tells the other phone to pull.

`vault_records` holds only the household id, the key version, a nonce, the
sealed blob and timestamps. It has no delete policy, and its trigger assigns the
pull order (`seq`) and drops an update older than the stored one.

`VaultProvider` (in the root layout) opens the phone's database, finds the
household key and keeps syncing. Her phone makes the key the first time it opens
while the household has nothing saved yet. Every other phone (the partner's, or
hers after a loss once records exist) gets it from Profile, Household key:
by scanning the QR code shown on a phone that has it, or by typing the recovery
phrase. A key that can't open what the household already saved is refused. The
web build has no keychain or on-phone database, so it skips all of this.

Screens read and write through `records.ts`: `useVaultQuery` reads from the
phone's store (it waits until the phone has the key, and is refreshed after every
pull), `saveItem` and `removeItems` write and start a sync, and `stableId` gives a
record the same id on both phones when it must not be doubled. The hooks in
`src/lib/data.ts` keep their old names and shapes. What each kind holds:

| Kind                        | One record per | Id |
| --------------------------- | -------------- | -- |
| `pregnancy`                 | household: LMP, due date, health details, care team, units | `stableId('pregnancy', household)` |
| `reading.<type>`            | weight, BP, sugar or sleep check-in | random |
| `tally.<kicks or water>.<day>` | tap, filed under the local day | random |
| `medication`                | medicine | random |
| `dose`                      | medicine per day ticked | `stableId('dose', medicine, day)` |
| `appointment`               | appointment | random |
| `bump-photo`                | bump diary photo: week, day added, a small thumbnail | random |
| `bump-image`                | the full photo of one `bump-photo` | random |
| `mood`                      | mood entry: mood, symptoms, note | random |
| `symptom`                   | symptom she added to the list | random |
| `contraction`               | timed contraction: session, start, end (null while going) | random |
| `contraction-session-end`   | session she ended herself | the session's id |
| `contraction-plan`          | household: what her doctor or midwife said about when to call, hospital, phone | `stableId('contraction-plan', household)` |
| `meta.copied`               | household, once its old rows are copied | `stableId('copied-old-tables', household)` |

The pregnancy details in the vault are laid over the `pregnancies` row, which
now only matters for its id and owner. Onboarding still creates that row.

On the first sync after a phone gets the key, `useCopyOldData` copies the
household's old rows (readings, medicines, doses, appointments and the
pregnancy details) into the vault, once per household. Copied records keep
their old ids and are dated when they were first saved, so running it on both
phones, or again, adds nothing twice and never undoes a later edit. It leaves
the old tables as they are.

Without the key (the partner's phone before pairing, or the web build), the
health screens show a notice instead of data, and reminders wait.

Bump photos are health data too, so they never go to Supabase Storage. The
phone shrinks each one (1280 px on the long side, JPEG) and keeps it as two
records, sealed and synced like the rest: a `bump-photo` with a 360 px
thumbnail, which is all the diary grid reads, and a `bump-image` with the
photo, read when she opens it. Each is a few hundred KB sealed, well under
`vault_records`' 2 MB limit, and uploads are split so one request carries at
most about 3 MB. The photo picker and resizer (`expo-image-picker`,
`expo-image-manipulator`) are in Expo Go.

Not done yet: key rotation, and emptying the old readable tables.
