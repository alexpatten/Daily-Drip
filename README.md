# Daily Drip ☕

One exam practice question a day for the Praxis Speech-Language Pathology (5331) or CompTIA Security+ (SY0-701) exam. React Native (Expo) app with a Supabase backend.

## How it works

Readers pick an exam in **Settings** (kept on the device) and get one question from it a day.

- **`exams`** lists the two exams. Both are `bank` exams: a fixed set of questions served in rotation. (The `daily` kind, a new batch of questions written for each date, is no longer used.)
- **`praxis_categories`** holds each exam's categories: 34 speech-language pathology categories (fluency, dysphagia, aphasia, AAC, ethics, …) and 28 Security+ categories, one per SY0-701 exam objective. (The table kept its original name so older app builds keep working.)
- **`daily_questions`** holds multiple-choice questions (A–D). Each has a `seq`, its place in its exam's rotation. Praxis SLP has 365, a year of questions at one a day, rotating through its 34 categories. Security+ has 626, weighted like the real exam's domains, with categories interleaved. Correct answers are spread evenly over A–D.
- **`todays_questions(exam, count)`** returns today's question; the app always asks for 1. Day *d* of an exam's rotation serves `seq` *d+1*, wrapping around, so a reader sees every question before any repeats. An answer counts only for the day it was given, so a question that comes back later starts fresh. Praxis's rotation started on 2026-10-21 and Security+'s on 2026-10-26. **`past_questions`** returns earlier days' sets, for signed-in users only.
- **Progress** (answers, streak days, awards) is saved on the device, and for signed-in readers also in **`progress`**, one row per account, so it follows them to every device. The app sends its changes through **`merge_progress(changes)`**, which merges rather than overwrites, and pulls the account's progress on sign-in and on return to the app (`src/lib/progress.ts`). (`retry_questions` is left over from when readers could do several a day; the app no longer uses it.)
- **Awards:** 15 of them, for right answers (1, 10, 100, 300), streaks (3, 7, 30, 100 days), answering every question an exam has so far, and a few extras (10 right in a row, early bird, night owl, …). Each has its own smiling coffee cup (`src/components/CoffeeBadge.tsx`), which spins in with falling petals when it's earned. They're worked out on the device from saved progress (`src/lib/awards.ts`); **`question_counts()`** supplies the totals for the "every question" awards.
- The day turns over at midnight Eastern (America/New_York). The Today screen picks up the new question at midnight even if it's left open.
- The app reads with the publishable key, through the functions above, and can't write questions. They're added and changed by migrations.

## Accounts

Today's question is open to everyone. An account (name, email, password) saves progress across devices and unlocks **Past brews**: earlier days' questions, newest first, which can be answered for practice. A day counts toward the streak when its question is answered that day; catch-up answers are scored but don't count. `past_questions()` enforces this: it returns nothing for signed-out users.

- **Sign up** stores the name in the user's metadata (`full_name`) and sends a verification email. The user taps the link instead of typing a code; Supabase confirms the email and redirects to the app's `auth-callback` screen, which signs them in.
- **Forgot password** emails a reset link that opens `auth-callback`, which then shows `reset-password` to choose a new password.
- Email templates live in `supabase/templates/` (`confirmation.html`, `recovery.html`) and are wired up in `supabase/config.toml`, along with `enable_confirmations = true`, an 8-character password minimum, and the app's redirect URLs (`dailydrip://**`, plus Expo Go and the web dev server).

Push the auth settings and templates to the hosted project:

```bash
npx supabase config push
```

Supabase's built-in email service only sends a few emails an hour, and only to your project team's addresses. Before real users sign up, set up custom SMTP (`[auth.email.smtp]` in `config.toml`, or Authentication → Emails in the dashboard).

## Changing the backend

Supabase settings live in `supabase/` (project `jluewvjtvxubevkkszxf`). To change the schema or the questions, add a migration and push it:

```bash
npx supabase db push
```

## Run the app

```bash
npm install
npx expo start        # then press i (iOS), a (Android), or w (web)
```

`.env` holds the Supabase URL and publishable key, which are safe to ship in the app.

The web build is hosted at https://dailydrip.alexpatten.com. Pushing to `main` redeploys it on ap-server-01 within a minute or two; see [`deploy/README.md`](deploy/README.md).

## Project layout

```
src/app/            screens (Expo Router): index = today, history = past brews, awards, settings,
                    sign-in, sign-up, forgot-password, reset-password, auth-callback
src/components/     QuestionCard, ChoiceButton, LatteHearts and CoffeeBadge art, Screen wrapper
src/lib/            Supabase client, auth, question queries, local progress, streaks + awards
supabase/           migrations, email templates, config
```
