# Daily Drip ☕

Daily exam practice questions, 1 to 25 a day, for the Praxis Speech-Language Pathology (5331) or CompTIA Security+ (SY0-701) exam. React Native (Expo) app with a Supabase backend.

## How it works

Readers pick an exam and how many questions a day they want (1–25, default 1) in **Settings**. Both are kept on the device.

- **`exams`** lists the two exams. Both are `bank` exams: a fixed set of questions served in rotation. (The `daily` kind, a new batch of questions written for each date, is no longer used.)
- **`praxis_categories`** holds each exam's categories: 34 speech-language pathology categories (fluency, dysphagia, aphasia, AAC, ethics, …) and 28 Security+ categories, one per SY0-701 exam objective. (The table kept its original name so older app builds keep working.)
- **`daily_questions`** holds multiple-choice questions (A–D). Each has a `seq`, its place in its exam's rotation. Praxis SLP has 365, a year of questions at one a day, rotating through its 34 categories. Security+ has 626, weighted like the real exam's domains, with categories interleaved. Correct answers are spread evenly over A–D.
- **`todays_questions(exam, count)`** returns today's set. Day *d* of an exam's rotation serves `seq` *d·count+1* through *d·count+count*, wrapping around, so a one-a-day reader sees every question before any repeats. Praxis's rotation started on 2026-10-21 and Security+'s on 2026-10-26. **`past_questions`** returns earlier days' sets, for signed-in users only.
- **Retries:** for readers doing 5 or more a day, questions they missed on the Today screen come back unanswered on a later day, mixed into the set in place of new questions so the count stays the same. They look like any other question, and keep coming back until answered correctly. The app tracks misses on the device (`src/lib/progress.ts`) and fetches them with **`retry_questions(exam, ids)`**, which only returns questions served before today.
- **Awards:** 18 of them, for right answers (1, 10, 100, 300), streaks (3, 7, 30, 100 days), answering every question an exam has so far, and a few extras (a perfect day, a retry answered right, 10 right in a row, early bird, night owl, …). Each has its own smiling coffee cup (`src/components/CoffeeBadge.tsx`), which spins in with falling petals when it's earned. They're worked out on the device from saved progress (`src/lib/awards.ts`); **`question_counts()`** supplies the totals for the "every question" awards.
- The day turns over at midnight Eastern (America/New_York).
- The app reads with the publishable key, through the functions above, and can't write questions. They're added and changed by migrations.

## Accounts

Today's questions are open to everyone. An account (name, email, password) unlocks **Past brews**: earlier days' questions, newest first, which can be answered for practice. A day counts toward the streak when all of its questions are answered that day; catch-up answers are scored but don't count. `past_questions()` enforces this: it returns nothing for signed-out users.

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
