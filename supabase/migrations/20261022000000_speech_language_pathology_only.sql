-- Daily Drip is now Praxis Speech-Language Pathology only.
-- Replace the general Praxis categories with SLP categories. Any questions from
-- the old categories go with them.

delete from public.daily_questions;
delete from public.praxis_categories;

-- Interleaved so consecutive days move between foundations, assessment, and treatment.
insert into public.praxis_categories (sort_order, slug, test_name, name, focus) values
  (1,  'ssd-assessment',            'Praxis SLP · Assessment & Diagnosis', 'Speech Sound Disorders: Assessment', 'articulation vs. phonological disorders, phonological processes and when they suppress, speech sound norms, stimulability, and intelligibility'),
  (2,  'typical-development',       'Praxis SLP · Foundations', 'Typical Speech & Language Development', 'speech sound acquisition ages, language milestones, Brown''s stages and MLU, and pragmatic and literacy development'),
  (3,  'fluency-treatment',         'Praxis SLP · Treatment', 'Fluency: Treatment', 'stuttering modification vs. fluency shaping, the Lidcombe Program, desensitization, cluttering treatment, and counseling'),
  (4,  'anatomy-physiology',        'Praxis SLP · Foundations', 'Anatomy & Physiology', 'respiration, phonation, resonance, and articulation structures, laryngeal muscles, and the phases of swallowing'),
  (5,  'aphasia-assessment',        'Praxis SLP · Assessment & Diagnosis', 'Aphasia: Assessment', 'classifying aphasia types (Broca''s, Wernicke''s, conduction, global, anomic, transcortical), lesion sites, and aphasia batteries'),
  (6,  'child-language-treatment',  'Praxis SLP · Treatment', 'Child Language Disorders: Treatment', 'developmental language disorder, recasting, focused stimulation, milieu teaching, narrative intervention, and writing goals'),
  (7,  'dysphagia-assessment',      'Praxis SLP · Assessment & Diagnosis', 'Dysphagia: Assessment', 'clinical swallow evaluation, videofluoroscopy (MBSS) vs. FEES, the penetration-aspiration scale, and signs of aspiration'),
  (8,  'ethics',                    'Praxis SLP · Professional Practice', 'Ethics & Scope of Practice', 'the ASHA Code of Ethics, the scope of practice, certification, and resolving ethical dilemmas'),
  (9,  'voice-treatment',           'Praxis SLP · Treatment', 'Voice Disorders: Treatment', 'vocal hygiene, resonant voice therapy, LSVT LOUD, vocal function exercises, and treating hyperfunction'),
  (10, 'autism-assessment',         'Praxis SLP · Assessment & Diagnosis', 'Autism & Social Communication: Assessment', 'early red flags, social communication assessment, joint attention, and DSM-5 criteria relevant to SLPs'),
  (11, 'motor-speech-treatment',    'Praxis SLP · Treatment', 'Motor Speech Disorders: Treatment', 'treating dysarthria, apraxia of speech, and childhood apraxia of speech (DTTC, principles of motor learning)'),
  (12, 'hearing',                   'Praxis SLP · Foundations', 'Hearing & Aural Rehabilitation', 'reading audiograms, conductive vs. sensorineural loss, tympanograms, hearing screening, cochlear implants, and aural rehab'),
  (13, 'child-language-assessment', 'Praxis SLP · Assessment & Diagnosis', 'Child Language Disorders: Assessment', 'standardized vs. dynamic assessment, language sampling, MLU, and identifying developmental language disorder'),
  (14, 'cognitive-treatment',       'Praxis SLP · Treatment', 'Cognitive-Communication: Treatment', 'TBI, dementia, and right hemisphere disorder treatment: spaced retrieval, memory aids, and attention and executive function training'),
  (15, 'research-ebp',              'Praxis SLP · Professional Practice', 'Research & Evidence-Based Practice', 'levels of evidence, single-subject designs, reliability and validity, sensitivity and specificity, and norm-referenced scores'),
  (16, 'ssd-treatment',             'Praxis SLP · Treatment', 'Speech Sound Disorders: Treatment', 'traditional articulation therapy, minimal and maximal pairs, the cycles approach, the complexity approach, and target selection'),
  (17, 'motor-speech-assessment',   'Praxis SLP · Assessment & Diagnosis', 'Motor Speech Disorders: Assessment', 'differential diagnosis of dysarthria types (flaccid, spastic, ataxic, hypokinetic, hyperkinetic, mixed), apraxia of speech, and CAS'),
  (18, 'dysphagia-treatment',       'Praxis SLP · Treatment', 'Dysphagia: Treatment', 'compensatory strategies, swallowing maneuvers (Mendelsohn, supraglottic, effortful), IDDSI diet levels, and rehabilitative exercises'),
  (19, 'legislation',               'Praxis SLP · Professional Practice', 'Legislation & Service Delivery', 'IDEA, IEPs and IFSPs, Section 504, ADA, HIPAA, FERPA, Medicare, and school vs. medical service delivery'),
  (20, 'fluency-assessment',        'Praxis SLP · Assessment & Diagnosis', 'Fluency: Assessment', 'stuttering-like vs. typical disfluencies, secondary behaviors, risk factors for persistence, and stuttering vs. cluttering'),
  (21, 'aphasia-treatment',         'Praxis SLP · Treatment', 'Aphasia: Treatment', 'semantic feature analysis, melodic intonation therapy, constraint-induced language therapy, script training, and supported conversation'),
  (22, 'aac',                       'Praxis SLP · Treatment', 'Augmentative & Alternative Communication', 'AAC assessment and feature matching, symbol systems, access methods, and AAC myths'),
  (23, 'voice-resonance-assessment','Praxis SLP · Assessment & Diagnosis', 'Voice & Resonance: Assessment', 'laryngeal pathologies, perceptual and acoustic voice measures, hypernasality vs. hyponasality, and referral to ENT'),
  (24, 'cultural-linguistic',       'Praxis SLP · Foundations', 'Cultural & Linguistic Diversity', 'difference vs. disorder, dialect features, bilingual language development, working with interpreters, and non-biased assessment'),
  (25, 'cognitive-assessment',      'Praxis SLP · Assessment & Diagnosis', 'Cognitive-Communication: Assessment', 'TBI and the Rancho Los Amigos scale, right hemisphere disorder, dementia stages, and cognitive-linguistic testing'),
  (26, 'autism-treatment',          'Praxis SLP · Treatment', 'Autism & Social Communication: Treatment', 'naturalistic developmental behavioral interventions, visual supports, social communication goals, and family coaching'),
  (27, 'cleft-craniofacial',        'Praxis SLP · Assessment & Diagnosis', 'Cleft Palate & Craniofacial Disorders', 'velopharyngeal dysfunction, compensatory articulation errors, nasal emission, and team management'),
  (28, 'speech-science',            'Praxis SLP · Foundations', 'Speech Science, Acoustics & Phonetics', 'fundamental frequency, formants, spectrograms, IPA transcription, and distinctive features'),
  (29, 'literacy',                  'Praxis SLP · Treatment', 'Literacy & Language-Based Learning', 'phonological awareness, decoding, dyslexia, written language, and the SLP''s role in literacy'),
  (30, 'counseling-collaboration',  'Praxis SLP · Professional Practice', 'Counseling, Collaboration & Supervision', 'counseling clients and families, interprofessional practice, supervising SLPAs and clinical fellows, and documentation'),
  (31, 'neuroscience',              'Praxis SLP · Foundations', 'Neuroscience of Communication', 'cortical language areas, cranial nerves for speech and swallowing, motor pathways, and the basal ganglia and cerebellum'),
  (32, 'early-intervention-feeding','Praxis SLP · Treatment', 'Early Intervention & Pediatric Feeding', 'birth-to-three services, coaching caregivers, IFSPs, NICU and infant feeding, and pediatric feeding disorders'),
  (33, 'genetic-syndromes',         'Praxis SLP · Foundations', 'Genetic Syndromes & Communication', 'communication profiles of Down syndrome, fragile X, 22q11.2 deletion, Williams, and Prader-Willi syndromes'),
  (34, 'head-neck-laryngectomy',    'Praxis SLP · Treatment', 'Laryngectomy, Tracheostomy & Head and Neck Cancer', 'tracheoesophageal speech, electrolarynx, esophageal speech, speaking valves, and post-radiation swallowing');
