// Writes the day's Praxis Speech-Language Pathology questions with Claude and stores them in
// public.daily_questions: a batch of DAILY_COUNT per date, each from a different category.
// Readers who want N questions a day see the first N. (Security+ questions are a fixed
// bank in the same table; this function doesn't touch them.)
//
// POST {} -> write any of today's (Eastern time) questions that are missing
//
// pg_cron calls this at midnight Eastern; the app never does. It only ever brews the
// current Eastern date, and only positions not written yet, so extra calls can't run up
// the Claude bill. A run that fails partway keeps what it wrote; the next run fills in
// the rest.

import Anthropic from "npm:@anthropic-ai/sdk@1.1.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const MODEL = "claude-opus-5-5";
const EXAM = "praxis-slp";
// The most questions a day a reader can choose.
const DAILY_COUNT = 25;
const LETTERS = ["A", "B", "C", "D"] as const;
type Letter = (typeof LETTERS)[number];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Category = {
  id: number;
  slug: string;
  name: string;
  test_name: string;
  focus: string;
  sort_order: number;
};

type GeneratedQuestion = {
  question: string;
  choices: Record<Letter, string>;
  correct_answer: Letter;
  explanation: string;
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), {
  auth: { persistSession: false },
});
// The whole batch is requested at once, so allow extra retries for rate limits.
const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY"), maxRetries: 4 });

function secretKey(): string {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) return JSON.parse(keys)["default"];
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// "YYYY-MM-DD" in America/New_York, so the day turns over at midnight Eastern.
function easternToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// The positions already written for a date and the categories they used.
async function writtenSoFar(date: string) {
  const { data, error } = await supabase
    .from("daily_questions")
    .select("position, category_id")
    .eq("exam", EXAM)
    .eq("question_date", date);
  if (error) throw error;
  return data;
}

// Least-recently-used rotation: categories never used come first (in sort order), then
// whichever was used longest ago (by date, then position in that day's batch). Categories
// already in today's batch are skipped, so a day never repeats one.
async function pickCategories(date: string, usedToday: Set<number>, count: number): Promise<Category[]> {
  const { data: categories, error: catError } = await supabase
    .from("praxis_categories")
    .select("id, slug, name, test_name, focus, sort_order")
    .eq("exam", EXAM)
    .order("sort_order");
  if (catError) throw catError;

  const { data: history, error: histError } = await supabase
    .from("daily_questions")
    .select("category_id, question_date, position")
    .eq("exam", EXAM)
    .lt("question_date", date)
    .order("question_date", { ascending: false })
    .order("position", { ascending: false })
    .limit(categories.length * 3);
  if (histError) throw histError;

  const lastUsed = new Map<number, string>();
  for (const h of history) {
    if (!lastUsed.has(h.category_id)) {
      lastUsed.set(h.category_id, `${h.question_date}#${String(h.position).padStart(2, "0")}`);
    }
  }

  const candidates = categories.filter((c) => !usedToday.has(c.id));
  candidates.sort((a, b) => {
    const la = lastUsed.get(a.id) ?? "";
    const lb = lastUsed.get(b.id) ?? "";
    if (la !== lb) return la < lb ? -1 : 1;
    return a.sort_order - b.sort_order;
  });
  return candidates.slice(0, count);
}

// Up to 15 of each category's most recent questions, so Claude can avoid repeating them.
async function recentQuestions(categoryIds: number[]): Promise<Map<number, string[]>> {
  const { data, error } = await supabase
    .from("daily_questions")
    .select("category_id, question")
    .in("category_id", categoryIds)
    .order("question_date", { ascending: false })
    .limit(categoryIds.length * 15);
  if (error) throw error;
  const byCategory = new Map<number, string[]>();
  for (const r of data) {
    const list = byCategory.get(r.category_id) ?? [];
    if (list.length < 15) list.push(r.question);
    byCategory.set(r.category_id, list);
  }
  return byCategory;
}

const SYSTEM_PROMPT = `You write practice questions for the Praxis Speech-Language Pathology exam (ETS test 5331), the licensure and ASHA certification exam for speech-language pathologists in the United States. Every question is about speech-language pathology and nothing else.

Each request names one content category. Write exactly one multiple-choice question that could plausibly appear on the Praxis SLP exam for that category:
- Match the real exam's difficulty and style. Prefer short clinical vignettes (a client's age, history, and observed behaviors) that ask for the best next step, most likely diagnosis, or most appropriate goal or approach, mixed with direct knowledge questions.
- Reflect current ASHA guidance and evidence-based practice. Don't reward approaches the evidence no longer supports (for example, nonspeech oral motor exercises for speech sound disorders).
- Exactly one choice is correct; the other three are plausible distractors built on common misconceptions.
- Never use "all of the above", "none of the above", or "both A and B".
- The question is read on a phone: keep the stem under about 100 words and each choice under about 20 words.
- Write phonetic symbols in IPA between slashes (/s/, /θ/) and any numbers in plain text, never LaTeX or Markdown.
- The explanation (2-4 sentences) says why the correct choice is right and why the most tempting distractor is wrong.
- Be factually precise. If a fact is disputed or has changed recently, pick a different angle.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    question: { type: "string" },
    choices: {
      type: "object",
      properties: {
        A: { type: "string" },
        B: { type: "string" },
        C: { type: "string" },
        D: { type: "string" },
      },
      required: ["A", "B", "C", "D"],
      additionalProperties: false,
    },
    correct_answer: { type: "string", enum: [...LETTERS] },
    explanation: { type: "string" },
  },
  required: ["question", "choices", "correct_answer", "explanation"],
  additionalProperties: false,
};

async function generateQuestion(category: Category, avoid: string[]): Promise<GeneratedQuestion> {
  // Models favour B and C when left to choose, so pick the answer position here.
  const target = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  const avoidList = avoid.length
    ? `\n\nThese questions were already used for this category. Cover a different concept:\n${avoid.map((q) => `- ${q}`).join("\n")}`
    : "";

  const response = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: OUTPUT_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          `Domain: ${category.test_name}\nCategory: ${category.name}\nCovers: ${category.focus}\n\n` +
          `Make choice ${target} the correct answer.${avoidList}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`Claude declined to write a question for ${category.slug}`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Claude's response was cut off");
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Claude returned no text");

  const parsed = JSON.parse(text.text) as GeneratedQuestion;
  const filled = [parsed.question, parsed.explanation, ...LETTERS.map((l) => parsed.choices?.[l])]
    .every((s) => typeof s === "string" && s.trim().length > 0);
  if (!filled || !LETTERS.includes(parsed.correct_answer)) {
    throw new Error("Claude returned an incomplete question");
  }
  return parsed;
}

async function writeQuestion(date: string, position: number, category: Category, avoid: string[]) {
  const q = await generateQuestion(category, avoid);

  // A concurrent run may have written this position first; keep whichever won.
  const { error } = await supabase.from("daily_questions").upsert(
    {
      exam: EXAM,
      question_date: date,
      position,
      category_id: category.id,
      question: q.question.trim(),
      choice_a: q.choices.A.trim(),
      choice_b: q.choices.B.trim(),
      choice_c: q.choices.C.trim(),
      choice_d: q.choices.D.trim(),
      correct_answer: q.correct_answer,
      explanation: q.explanation.trim(),
      model: MODEL,
    },
    { onConflict: "exam,question_date,position", ignoreDuplicates: true },
  );
  if (error) throw error;
}

// Writes the date's missing positions in parallel. Each question is saved as soon as it's
// ready, so one failure doesn't lose the rest.
async function brewDay(date: string) {
  const written = await writtenSoFar(date);
  const taken = new Set(written.map((w) => w.position));
  const missing = Array.from({ length: DAILY_COUNT }, (_, i) => i + 1).filter((p) => !taken.has(p));
  if (missing.length === 0) return { date, written: 0, failed: 0 };

  const categories = await pickCategories(date, new Set(written.map((w) => w.category_id)), missing.length);
  const avoid = await recentQuestions(categories.map((c) => c.id));
  const results = await Promise.allSettled(
    categories.map((category, i) =>
      writeQuestion(date, missing[i], category, avoid.get(category.id) ?? []),
    ),
  );
  for (const r of results) if (r.status === "rejected") console.error(r.reason);
  const failed = results.filter((r) => r.status === "rejected").length;
  return { date, written: results.length - failed, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  try {
    const result = await brewDay(easternToday());
    return json(result, result.failed ? 500 : 200);
  } catch (err) {
    console.error(err);
    if (err instanceof Anthropic.APIError) {
      return json({ error: `Claude API error ${err.status}` }, 502);
    }
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
