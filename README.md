# Daily Drip ☕

One Praxis Speech-Language Pathology (5331) practice question a day, freshly brewed by Claude. React Native (Expo) app with a Supabase backend.

## How it works

- **`praxis_categories`** holds 34 speech-language pathology categories across the exam's domains (Foundations & Professional Practice, Assessment & Diagnosis, Treatment), e.g. fluency, dysphagia, aphasia, voice, motor speech, AAC, and ethics.
- **`daily_questions`** holds one multiple-choice question (A–D) per date.
- **`daily-question` edge function** asks Claude (`claude-opus-5-5`) for a question in the next category and stores it. Categories rotate least-recently-used, so every category comes up before any repeats, and two days in a row never share one.
- **pg_cron** calls the function at midnight Eastern (America/New_York) to brew that day's question. It runs at 04:00, 05:00 and 06:00 UTC so it covers both daylight and standard time, plus a retry; the function brews each Eastern date once. The app never calls the function: it shows the newest released question, so the day turns over at midnight Eastern for everyone.
- The app reads with the publishable key. Row Level Security allows reads only; only the edge function writes.

## Accounts

Today's question is open to everyone. An account (name, email, password) unlocks **Past brews**: every earlier question, newest first, which can be answered for practice. Catch-up answers are scored but don't count toward the streak. Row Level Security enforces this: anyone can read the current question (`public.current_question_date()`), and only signed-in users can read older ones.

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

## Project layout

```
src/app/            screens (Expo Router): index = today, history = past brews,
                    sign-in, sign-up, forgot-password, reset-password, auth-callback
src/components/     QuestionCard, ChoiceButton, LatteHearts art, Screen wrapper
src/lib/            Supabase client, auth, question queries, local progress + streaks
supabase/           migrations, edge function, email templates, config
```
