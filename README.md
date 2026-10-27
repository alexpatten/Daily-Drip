# Daily Drip ☕

Daily exam practice questions, 1 to 25 a day, for the Praxis Speech-Language Pathology (5331) or CompTIA Security+ (SY0-701) exam. React Native (Expo) app with a Supabase backend.

## How it works

Readers pick an exam and how many questions a day they want (1–25, default 1) in **Settings**. Both are kept on the device.

- **`exams`** lists the two exams. Praxis SLP is a `daily` exam: Claude writes fresh questions every day. Security+ is a `bank` exam: a fixed set of questions served in rotation.
- **`praxis_categories`** holds each exam's categories: 34 speech-language pathology categories (fluency, dysphagia, aphasia, AAC, ethics, …) and 28 Security+ categories, one per SY0-701 exam objective. (The table kept its original name so older app builds keep working.)
- **`daily_questions`** holds multiple-choice questions (A–D). Praxis questions have a `question_date` and a `position` (1–25) in that day's batch. Security+ questions have a `seq`, their place in the rotation: 626 questions weighted like the real exam's domains, with categories interleaved and correct answers spread evenly over A–D.
- **`todays_questions(exam, count)`** returns today's set. For Praxis, that's the first `count` of today's batch. For Security+, day *d* of the rotation serves `seq` *d·count+1* through *d·count+count*, wrapping around, so a one-a-day reader sees every question before any repeats. **`past_questions`** returns earlier days' sets, for signed-in users only.
- **Retries:** for readers doing 5 or more a day, questions they missed on the Today screen come back unanswered on a later day, mixed into the set in place of new questions so the count stays the same. They look like any other question, and keep coming back until answered correctly. The app tracks misses on the device (`src/lib/progress.ts`) and fetches them with **`retry_questions(exam, ids)`**, which only returns questions served before today.
- **`daily-question` edge function** asks Claude (`claude-opus-5-5`) for the day's 25 Praxis questions in parallel, one per category, and saves each as it's ready. Categories rotate least-recently-used, and a day never repeats one. It only writes positions that are missing, so a rerun fills in anything that failed.
- **pg_cron** calls the function at midnight Eastern (America/New_York) to brew that day's batch. It runs at 04:00, 05:00 and 06:00 UTC so it covers both daylight and standard time, plus retries. The app never calls the function. If a brew fails, the app keeps showing the newest batch.
- The app reads with the publishable key, through the functions above. Row Level Security allows reads only; only the edge function writes.

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

## One-time setup

Give the edge function a Claude API key:

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Supabase settings live in `supabase/` (project `jluewvjtvxubevkkszxf`). To change the schema or the function:

```bash
npx supabase db push                                   # apply new migrations
npx supabase functions deploy daily-question --no-verify-jwt
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
src/app/            screens (Expo Router): index = today, history = past brews, settings,
                    sign-in, sign-up, forgot-password, reset-password, auth-callback
src/components/     QuestionCard, ChoiceButton, LatteHearts art, Screen wrapper
src/lib/            Supabase client, auth, question queries, local progress + streaks
supabase/           migrations, edge function, email templates, config
```
