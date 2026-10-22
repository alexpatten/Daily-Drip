-- Daily Drip: one Praxis practice question per day, rotating through categories.

create table public.praxis_categories (
  id smallint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  test_name text not null,
  focus text not null,
  sort_order smallint not null unique
);

create table public.daily_questions (
  id bigint generated always as identity primary key,
  question_date date not null unique,
  category_id smallint not null references public.praxis_categories (id),
  question text not null,
  choice_a text not null,
  choice_b text not null,
  choice_c text not null,
  choice_d text not null,
  correct_answer char(1) not null check (correct_answer in ('A', 'B', 'C', 'D')),
  explanation text not null,
  model text not null,
  created_at timestamptz not null default now()
);

create index daily_questions_category_date_idx
  on public.daily_questions (category_id, question_date desc);

-- Read-only for the app. Only the edge function (secret key) writes.
alter table public.praxis_categories enable row level security;
alter table public.daily_questions enable row level security;

grant select on public.praxis_categories to anon, authenticated;
grant select on public.daily_questions to anon, authenticated;

create policy "Categories are public"
  on public.praxis_categories for select
  to anon, authenticated
  using (true);

-- current_date is UTC; +1 lets users east of UTC see their "today".
create policy "Released questions are public"
  on public.daily_questions for select
  to anon, authenticated
  using (question_date <= current_date + 1);

-- Categories are interleaved so consecutive days jump between tests.
insert into public.praxis_categories (sort_order, slug, test_name, name, focus) values
  (1,  'core-reading-key-ideas',      'Praxis Core: Reading', 'Key Ideas & Details', 'main idea, supporting details, inferences, and summarizing short passages'),
  (2,  'plt-students-as-learners',    'Principles of Learning and Teaching', 'Students as Learners', 'human development, learning theories (Piaget, Vygotsky, Bloom, Maslow, Erikson), learner diversity and motivation'),
  (3,  'core-math-number-quantity',   'Praxis Core: Mathematics', 'Number & Quantity', 'fractions, decimals, percents, ratios, proportional reasoning, and order of operations'),
  (4,  'elem-reading-language-arts',  'Elementary Education: Multiple Subjects', 'Reading & Language Arts', 'foundational literacy, comprehension strategies, writing process, and grammar for elementary teachers'),
  (5,  'core-writing-language',       'Praxis Core: Writing', 'Language & Research Skills', 'grammar, usage, sentence structure, mechanics, and citing and evaluating research sources'),
  (6,  'teaching-reading-phonics',    'Teaching Reading', 'Phonological Awareness & Phonics', 'phonemic awareness, phonics, decoding, word recognition, and emergent literacy'),
  (7,  'core-math-algebra',           'Praxis Core: Mathematics', 'Algebra & Functions', 'linear equations, inequalities, expressions, patterns, and interpreting functions'),
  (8,  'plt-instructional-process',   'Principles of Learning and Teaching', 'Instructional Process', 'planning instruction, instructional strategies, questioning, scaffolding, and classroom management'),
  (9,  'elem-mathematics',            'Elementary Education: Multiple Subjects', 'Mathematics', 'number sense, operations, place value, measurement, geometry, and data for elementary grades'),
  (10, 'english-literature',          'English Language Arts: Content Knowledge', 'Literature & Literary Analysis', 'literary periods, genres, authors, literary devices, poetry, and interpreting texts'),
  (11, 'core-reading-craft',          'Praxis Core: Reading', 'Craft, Structure & Language Skills', 'author''s purpose, tone, point of view, text structure, and word meaning in context'),
  (12, 'special-ed-foundations',      'Special Education: Core Knowledge', 'Foundations & Legal Requirements', 'IDEA, Section 504, IEPs, least restrictive environment, FAPE, and disability categories'),
  (13, 'biology',                     'Biology: Content Knowledge', 'Biology', 'cells, genetics, evolution, ecology, and human body systems'),
  (14, 'plt-assessment',              'Principles of Learning and Teaching', 'Assessment', 'formative vs. summative assessment, validity, reliability, norm- vs. criterion-referenced tests, and using data'),
  (15, 'us-history',                  'Social Studies: Content Knowledge', 'U.S. History', 'major eras, events, documents, and movements in United States history'),
  (16, 'core-math-geometry',          'Praxis Core: Mathematics', 'Geometry', 'area, perimeter, volume, angles, the coordinate plane, and properties of shapes'),
  (17, 'esol-linguistics',            'English to Speakers of Other Languages', 'Linguistics & Language Acquisition', 'phonology, morphology, syntax, semantics, and second language acquisition theory (Krashen, BICS/CALP)'),
  (18, 'elem-social-studies',         'Elementary Education: Multiple Subjects', 'Social Studies', 'U.S. and world history, geography, civics, and economics at the elementary level'),
  (19, 'core-writing-text-types',     'Praxis Core: Writing', 'Text Types, Purposes & Production', 'argumentative and informative writing, organization, revision, and essay development'),
  (20, 'chemistry',                   'Chemistry: Content Knowledge', 'Chemistry', 'atomic structure, the periodic table, bonding, stoichiometry, reactions, and solutions'),
  (21, 'teaching-reading-comprehension', 'Teaching Reading', 'Fluency, Vocabulary & Comprehension', 'reading fluency, vocabulary instruction, comprehension strategies, and reading assessment'),
  (22, 'world-history',               'World History', 'World History', 'ancient civilizations through the modern era, empires, revolutions, and global interactions'),
  (23, 'core-math-statistics',        'Praxis Core: Mathematics', 'Statistics & Probability', 'mean, median, mode, range, reading graphs and tables, and basic probability'),
  (24, 'plt-professional',            'Principles of Learning and Teaching', 'Professional Development, Leadership & Community', 'reflective practice, collaboration, family engagement, legal and ethical responsibilities'),
  (25, 'elem-science',                'Elementary Education: Multiple Subjects', 'Science', 'earth, life, and physical science and scientific inquiry at the elementary level'),
  (26, 'physics',                     'Physics: Content Knowledge', 'Physics', 'motion, forces, energy, waves, electricity, and magnetism'),
  (27, 'government-civics',           'Government/Political Science', 'Government & Civics', 'the U.S. Constitution, branches of government, rights, federalism, and political processes'),
  (28, 'special-ed-instruction',      'Special Education: Core Knowledge', 'Instruction, Assessment & Behavior', 'accommodations vs. modifications, evidence-based interventions, RTI/MTSS, and behavior plans'),
  (29, 'core-reading-integration',    'Praxis Core: Reading', 'Integration of Knowledge & Ideas', 'evaluating arguments, comparing texts, analyzing visual data, and drawing conclusions'),
  (30, 'early-childhood',             'Early Childhood Education', 'Early Childhood Education', 'child development from birth to age 8, play-based learning, and developmentally appropriate practice'),
  (31, 'middle-school-math',          'Middle School Mathematics', 'Middle School Math', 'ratios, rational numbers, expressions and equations, geometry, and statistics for grades 5-9'),
  (32, 'english-language-use',        'English Language Arts: Content Knowledge', 'Language Use & Vocabulary', 'etymology, grammar conventions, dialects, rhetoric, and vocabulary development'),
  (33, 'earth-space-science',         'Earth and Space Sciences', 'Earth & Space Science', 'geology, plate tectonics, weather and climate, oceans, and astronomy'),
  (34, 'esol-culture-professional',   'English to Speakers of Other Languages', 'Culture, Instruction & Advocacy', 'culturally responsive teaching, ELL assessment, program models, and advocacy for ELLs'),
  (35, 'economics',                   'Economics', 'Economics', 'supply and demand, markets, micro- and macroeconomics, and personal finance'),
  (36, 'high-school-math',            'Mathematics: Content Knowledge', 'Advanced Mathematics', 'functions, trigonometry, calculus concepts, number theory, and discrete math'),
  (37, 'geography',                   'Geography', 'Geography', 'physical and human geography, maps, regions, and human-environment interaction'),
  (38, 'health-pe',                   'Health and Physical Education', 'Health & Physical Education', 'motor development, fitness, nutrition, health promotion, and PE instruction'),
  (39, 'school-leadership',           'Educational Leadership', 'Educational Leadership', 'school vision, instructional leadership, school climate, and education law for administrators'),
  (40, 'gifted-education',            'Gifted Education', 'Gifted Education', 'identifying gifted learners, differentiation, acceleration, and enrichment models'),
  (41, 'art',                         'Art: Content and Analysis', 'Art', 'art history, elements and principles of design, media, and art criticism'),
  (42, 'music',                       'Music: Content and Instruction', 'Music', 'music theory, history, notation, and music teaching methods'),
  (43, 'computer-science',            'Computer Science', 'Computer Science', 'algorithms, programming concepts, data, networks, and the impacts of computing'),
  (44, 'school-library',              'Library Media Specialist', 'Library Media', 'information literacy, collection development, copyright, and research instruction'),
  (45, 'school-counselor',            'Professional School Counselor', 'School Counseling', 'counseling theories, the ASCA model, college and career readiness, and ethics');

-- Generate today's and tomorrow's questions shortly after midnight UTC.
-- The edge function generates each date at most once, so re-runs are harmless.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'daily-praxis-question',
  '5 0 * * *',
  $$
  select net.http_post(
    url := 'https://jluewvjtvxubevkkszxf.supabase.co/functions/v1/daily-question',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
