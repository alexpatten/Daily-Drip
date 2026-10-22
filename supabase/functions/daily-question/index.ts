// Generates (at most once per date) the Praxis Speech-Language Pathology question of the day with Claude
// and stores it in public.daily_questions.
//
// POST {} -> ensure today's question (Eastern time) exists and return it
//
// pg_cron calls this at midnight Eastern; the app never does. It only ever brews the
// current Eastern date, so extra calls can't run up the Claude bill.

import Anthropic from "npm:@anthropic-ai/sdk@1.1.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const MODEL = "claude-opus-5-5";
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

const QUESTION_SELECT =
  "id, question_date, question, choice_a, choice_b, choice_c, choice_d, correct_answer, explanation, " +
  "category:praxis_categories(name, test_name)";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), {
  auth: { persistSession: false },
});
const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

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

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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

async function findQuestion(date: string) {
  const { data, error } = await supabase
    .from("daily_questions")
    .select(QUESTION_SELECT)
    .eq("question_date", date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Least-recently-used rotation: categories never used come first (in sort order),
// then whichever was used longest ago. Neighbouring days are always excluded, so
// two days in a row never share a category.
async function pickCategory(date: string): Promise<Category> {
  const { data: categories, error: catError } = await supabase
    .from("praxis_categories")
    .select("id, slug, name, test_name, focus, sort_order")
    .order("sort_order");
  if (catError) throw catError;

  const { data: history, error: histError } = await supabase
    .from("daily_questions")
    .select("category_id, question_date")
    .neq("question_date", date)
    .order("question_date", { ascending: false })
    .limit(categories.length * 3);
  if (histError) throw histError;

  const neighbours = new Set([addDays(date, -1), addDays(date, 1)]);
  const blocked = new Set(
    history.filter((h) => neighbours.has(h.question_date)).map((h) => h.category_id),
  );
  const lastUsed = new Map<number, string>();
  for (const h of history) {
    if (!lastUsed.has(h.category_id)) lastUsed.set(h.category_id, h.question_date);
  }

  const candidates = categories.filter((c) => !blocked.has(c.id));
  candidates.sort((a, b) => {
    const la = lastUsed.get(a.id) ?? "";
    const lb = lastUsed.get(b.id) ?? "";
    if (la !== lb) return la < lb ? -1 : 1;
    return a.sort_order - b.sort_order;
  });
  return candidates[0];
}

async function recentQuestions(categoryId: number): Promise<string[]> {
  const { data, error } = await supabase
    .from("daily_questions")
    .select("question")
    .eq("category_id", categoryId)
    .order("question_date", { ascending: false })
    .limit(15);
  if (error) throw error;
  return data.map((r) => r.question);
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

async function ensureQuestion(date: string) {
  const existing = await findQuestion(date);
  if (existing) return existing;

  const category = await pickCategory(date);
  const q = await generateQuestion(category, await recentQuestions(category.id));

  // A concurrent request may have inserted this date first; keep whichever won.
  const { error } = await supabase.from("daily_questions").upsert(
    {
      question_date: date,
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
    { onConflict: "question_date", ignoreDuplicates: true },
  );
  if (error) throw error;
  return await findQuestion(date);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  try {
    return json({ question: await ensureQuestion(easternToday()) });
  } catch (err) {
    console.error(err);
    if (err instanceof Anthropic.APIError) {
      return json({ error: `Claude API error ${err.status}` }, 502);
    }
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
