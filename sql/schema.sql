-- =============================================================
-- LearnSpark – Supabase Schema
-- Paste this entire file into:
-- Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================

-- Enable UUID extension (already on by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- PROFILES
-- Extends Supabase auth.users with app-specific fields.
-- A row is created here whenever a user signs up.
-- =============================================================
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
  grade         INT DEFAULT 6,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create a profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, username, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================
-- SUBJECTS
-- =============================================================
CREATE TABLE subjects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        TEXT UNIQUE NOT NULL,  -- 'math', 'sci', 'eng'
  name        TEXT NOT NULL,
  icon        TEXT,
  description TEXT,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- WEEKS (lesson units within a subject)
-- =============================================================
CREATE TABLE weeks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id   UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  week_number  INT NOT NULL,
  title        TEXT NOT NULL,
  overview     TEXT,         -- short summary shown on the subject page
  lesson_body  TEXT,         -- full lesson content (can be HTML)
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, week_number)
);

-- =============================================================
-- LEARNING OBJECTIVES
-- =============================================================
CREATE TABLE learning_objectives (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_id        UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  objective_text TEXT NOT NULL,
  sort_order     INT DEFAULT 0
);

-- =============================================================
-- RESOURCES (downloadable files)
-- storage_path = path inside the 'resources' Supabase Storage bucket
-- =============================================================
CREATE TABLE resources (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_id      UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  file_type    TEXT DEFAULT 'PDF',
  icon         TEXT DEFAULT '📄',
  storage_path TEXT,         -- e.g. 'math/week1/fractions-worksheet.pdf'
  sort_order   INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- QUIZ QUESTIONS
-- =============================================================
CREATE TABLE quiz_questions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_id       UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  sort_order    INT DEFAULT 0
);

-- =============================================================
-- QUIZ OPTIONS (answer choices for each question)
-- =============================================================
CREATE TABLE quiz_options (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct  BOOLEAN DEFAULT FALSE,
  sort_order  INT DEFAULT 0
);

-- =============================================================
-- COMPLETED LESSONS
-- =============================================================
CREATE TABLE completed_lessons (
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_id      UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, week_id)
);

-- =============================================================
-- QUIZ RESULTS
-- =============================================================
CREATE TABLE quiz_results (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_id          UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  score            INT NOT NULL,
  total_questions  INT NOT NULL,
  percentage       INT NOT NULL,
  taken_at         TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- STUDENT PROGRESS (per subject summary, auto-updated)
-- =============================================================
CREATE TABLE student_progress (
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id       UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  percent_complete INT DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, subject_id)
);

-- =============================================================
-- EARNED BADGES
-- =============================================================
CREATE TABLE earned_badges (
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id  TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

-- =============================================================
-- ROW LEVEL SECURITY (RLS)
-- Supabase requires this so users can only see their own data.
-- =============================================================

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources         ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_options      ENABLE ROW LEVEL SECURITY;
ALTER TABLE completed_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results      ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_progress  ENABLE ROW LEVEL SECURITY;
ALTER TABLE earned_badges     ENABLE ROW LEVEL SECURITY;

-- Public read for all authenticated users (content tables)
CREATE POLICY "Auth users can read subjects"     ON subjects          FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can read weeks"        ON weeks             FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can read objectives"   ON learning_objectives FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can read resources"    ON resources         FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can read questions"    ON quiz_questions    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can read options"      ON quiz_options      FOR SELECT TO authenticated USING (true);

-- Profiles: users read own, admins/teachers read all
CREATE POLICY "Users read own profile"           ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Teachers and admins read all"     ON profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin')));
CREATE POLICY "Admins update role"               ON profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Student data: own rows only
CREATE POLICY "Own completed lessons"   ON completed_lessons FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own quiz results"        ON quiz_results      FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own student progress"    ON student_progress  FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own earned badges"       ON earned_badges     FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Teachers/admins can read all student data
CREATE POLICY "Teachers read all results"    ON quiz_results      FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin')));
CREATE POLICY "Teachers read all progress"   ON student_progress  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin')));
CREATE POLICY "Teachers read all completed"  ON completed_lessons FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin')));

-- =============================================================
-- SEED DATA – 3 subjects, 3 weeks each, 5 quiz questions each
-- Run this after the schema above.
-- =============================================================

-- Subjects
INSERT INTO subjects (slug, name, icon, description, sort_order) VALUES
  ('math', 'Mathematics', '🔢', 'Numbers, patterns and problem-solving adventures!', 1),
  ('sci',  'Science',     '🔬', 'Explore the wonders of the natural world!',          2),
  ('eng',  'English',     '📖', 'Words, stories and the power of language!',           3);

-- ── MATHS WEEKS ──
WITH s AS (SELECT id FROM subjects WHERE slug = 'math')
INSERT INTO weeks (subject_id, week_number, title, overview) VALUES
  ((SELECT id FROM s), 1, 'Fractions & Decimals',    'Fractions are everywhere — sharing a pizza, measuring ingredients, reading a ruler. This week you will write, compare, and convert fractions into decimals.'),
  ((SELECT id FROM s), 2, 'Multiplication & Division','Multiplication and division are the power tools of maths. You will multiply large numbers, divide with remainders, and solve real-world word problems.'),
  ((SELECT id FROM s), 3, 'Geometry Basics',          'Geometry is the art of shapes and space. Discover properties of shapes, measure area and perimeter, and explore types of angles.');

-- Math Week 1 objectives
WITH w AS (SELECT id FROM weeks WHERE week_number=1 AND subject_id=(SELECT id FROM subjects WHERE slug='math'))
INSERT INTO learning_objectives (week_id, objective_text, sort_order) VALUES
  ((SELECT id FROM w), 'Understand proper and improper fractions', 1),
  ((SELECT id FROM w), 'Convert fractions to decimals',            2),
  ((SELECT id FROM w), 'Compare and order fractions',              3);

-- Math Week 1 quiz
WITH w AS (SELECT id FROM weeks WHERE week_number=1 AND subject_id=(SELECT id FROM subjects WHERE slug='math'))
INSERT INTO quiz_questions (week_id, question_text, sort_order) VALUES
  ((SELECT id FROM w), 'What is 3/4 as a decimal?', 1),
  ((SELECT id FROM w), 'Which fraction is larger: 2/3 or 3/4?', 2),
  ((SELECT id FROM w), 'What is 1/2 + 1/4?', 3),
  ((SELECT id FROM w), 'Convert 0.6 to a fraction in simplest form:', 4),
  ((SELECT id FROM w), 'How many quarters make one whole?', 5);

-- Math W1 Q1 options
WITH q AS (SELECT id FROM quiz_questions WHERE question_text='What is 3/4 as a decimal?' LIMIT 1)
INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order) VALUES
  ((SELECT id FROM q), '0.25', false, 1),
  ((SELECT id FROM q), '0.50', false, 2),
  ((SELECT id FROM q), '0.75', true,  3),
  ((SELECT id FROM q), '1.00', false, 4);

WITH q AS (SELECT id FROM quiz_questions WHERE question_text='Which fraction is larger: 2/3 or 3/4?' LIMIT 1)
INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order) VALUES
  ((SELECT id FROM q), '2/3',            false, 1),
  ((SELECT id FROM q), '3/4',            true,  2),
  ((SELECT id FROM q), 'They are equal', false, 3),
  ((SELECT id FROM q), 'Cannot compare', false, 4);

WITH q AS (SELECT id FROM quiz_questions WHERE question_text='What is 1/2 + 1/4?' LIMIT 1)
INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order) VALUES
  ((SELECT id FROM q), '2/6', false, 1),
  ((SELECT id FROM q), '3/4', true,  2),
  ((SELECT id FROM q), '1/3', false, 3),
  ((SELECT id FROM q), '2/4', false, 4);

WITH q AS (SELECT id FROM quiz_questions WHERE question_text='Convert 0.6 to a fraction in simplest form:' LIMIT 1)
INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order) VALUES
  ((SELECT id FROM q), '6/10',  false, 1),
  ((SELECT id FROM q), '3/5',   true,  2),
  ((SELECT id FROM q), '60/100',false, 3),
  ((SELECT id FROM q), '2/3',   false, 4);

WITH q AS (SELECT id FROM quiz_questions WHERE question_text='How many quarters make one whole?' LIMIT 1)
INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order) VALUES
  ((SELECT id FROM q), '2', false, 1),
  ((SELECT id FROM q), '3', false, 2),
  ((SELECT id FROM q), '4', true,  3),
  ((SELECT id FROM q), '5', false, 4);

-- ── SCIENCE WEEK 1 ──
WITH s AS (SELECT id FROM subjects WHERE slug='sci')
INSERT INTO weeks (subject_id, week_number, title, overview) VALUES
  ((SELECT id FROM s), 1, 'The Human Body',      'Your body is an incredible machine. This week we explore the systems that keep you alive — heart, lungs, brain — and discover how they work together.'),
  ((SELECT id FROM s), 2, 'Plants & Photosynthesis', 'Plants are nature''s solar panels! Learn how leaves capture sunlight and turn CO₂ and water into food through photosynthesis.'),
  ((SELECT id FROM s), 3, 'Forces & Motion',     'Everything moves because of forces. Pushes and pulls make objects start, stop, or change direction. Explore gravity, friction, and how scientists measure motion.');

WITH w AS (SELECT id FROM weeks WHERE week_number=1 AND subject_id=(SELECT id FROM subjects WHERE slug='sci'))
INSERT INTO learning_objectives (week_id, objective_text, sort_order) VALUES
  ((SELECT id FROM w), 'Name the major body systems', 1),
  ((SELECT id FROM w), 'Understand organ functions',  2),
  ((SELECT id FROM w), 'Learn healthy habits',        3);

WITH w AS (SELECT id FROM weeks WHERE week_number=1 AND subject_id=(SELECT id FROM subjects WHERE slug='sci'))
INSERT INTO quiz_questions (week_id, question_text, sort_order) VALUES
  ((SELECT id FROM w), 'Which organ pumps blood through the body?', 1),
  ((SELECT id FROM w), 'An adult human body has how many bones?', 2),
  ((SELECT id FROM w), 'Main function of the lungs:', 3),
  ((SELECT id FROM w), 'The brain and spinal cord belong to which system?', 4),
  ((SELECT id FROM w), 'The largest organ in the human body is:', 5);

WITH q AS (SELECT id FROM quiz_questions WHERE question_text='Which organ pumps blood through the body?' LIMIT 1)
INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order) VALUES
  ((SELECT id FROM q), 'Lungs',  false, 1),
  ((SELECT id FROM q), 'Liver',  false, 2),
  ((SELECT id FROM q), 'Heart',  true,  3),
  ((SELECT id FROM q), 'Kidney', false, 4);

WITH q AS (SELECT id FROM quiz_questions WHERE question_text='An adult human body has how many bones?' LIMIT 1)
INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order) VALUES
  ((SELECT id FROM q), '106', false, 1),
  ((SELECT id FROM q), '206', true,  2),
  ((SELECT id FROM q), '306', false, 3),
  ((SELECT id FROM q), '406', false, 4);

WITH q AS (SELECT id FROM quiz_questions WHERE question_text='Main function of the lungs:' LIMIT 1)
INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order) VALUES
  ((SELECT id FROM q), 'Digest food',             false, 1),
  ((SELECT id FROM q), 'Pump blood',              false, 2),
  ((SELECT id FROM q), 'Exchange oxygen and CO₂', true,  3),
  ((SELECT id FROM q), 'Filter blood',            false, 4);

WITH q AS (SELECT id FROM quiz_questions WHERE question_text='The brain and spinal cord belong to which system?' LIMIT 1)
INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order) VALUES
  ((SELECT id FROM q), 'Digestive',    false, 1),
  ((SELECT id FROM q), 'Nervous',      true,  2),
  ((SELECT id FROM q), 'Circulatory',  false, 3),
  ((SELECT id FROM q), 'Respiratory',  false, 4);

WITH q AS (SELECT id FROM quiz_questions WHERE question_text='The largest organ in the human body is:' LIMIT 1)
INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order) VALUES
  ((SELECT id FROM q), 'Liver', false, 1),
  ((SELECT id FROM q), 'Brain', false, 2),
  ((SELECT id FROM q), 'Skin',  true,  3),
  ((SELECT id FROM q), 'Heart', false, 4);

-- ── ENGLISH WEEK 1 ──
WITH s AS (SELECT id FROM subjects WHERE slug='eng')
INSERT INTO weeks (subject_id, week_number, title, overview) VALUES
  ((SELECT id FROM s), 1, 'Reading Comprehension', 'Reading is a superpower. This week you practise finding the main idea, making connections, and reading between the lines.'),
  ((SELECT id FROM s), 2, 'Grammar & Writing',     'Grammar is the foundation of clear communication. Review parts of speech, practise punctuation, and write well-organised paragraphs.'),
  ((SELECT id FROM s), 3, 'Vocabulary & Spelling', 'The more words you know, the better you express yourself. Learn context clue strategies and build vocabulary through roots and patterns.');

WITH w AS (SELECT id FROM weeks WHERE week_number=1 AND subject_id=(SELECT id FROM subjects WHERE slug='eng'))
INSERT INTO learning_objectives (week_id, objective_text, sort_order) VALUES
  ((SELECT id FROM w), 'Identify main ideas and supporting details', 1),
  ((SELECT id FROM w), 'Make inferences from text',                  2),
  ((SELECT id FROM w), 'Understand story structure',                  3);

WITH w AS (SELECT id FROM weeks WHERE week_number=1 AND subject_id=(SELECT id FROM subjects WHERE slug='eng'))
INSERT INTO quiz_questions (week_id, question_text, sort_order) VALUES
  ((SELECT id FROM w), 'The "main idea" of a paragraph is:', 1),
  ((SELECT id FROM w), 'Making an "inference" means:', 2),
  ((SELECT id FROM w), 'Which feature helps you find topics quickly?', 3),
  ((SELECT id FROM w), 'The "setting" of a story refers to:', 4),
  ((SELECT id FROM w), 'A supporting detail helps to:', 5);

WITH q AS (SELECT id FROM quiz_questions WHERE question_text='The "main idea" of a paragraph is:' LIMIT 1)
INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order) VALUES
  ((SELECT id FROM q), 'The first sentence',           false, 1),
  ((SELECT id FROM q), 'The longest sentence',         false, 2),
  ((SELECT id FROM q), 'The central topic or message', true,  3),
  ((SELECT id FROM q), 'The last sentence',            false, 4);

WITH q AS (SELECT id FROM quiz_questions WHERE question_text='Making an "inference" means:' LIMIT 1)
INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order) VALUES
  ((SELECT id FROM q), 'Copying the text',                       false, 1),
  ((SELECT id FROM q), 'Guessing randomly',                      false, 2),
  ((SELECT id FROM q), 'Using clues to figure something out',    true,  3),
  ((SELECT id FROM q), 'Summarising everything',                 false, 4);

WITH q AS (SELECT id FROM quiz_questions WHERE question_text='Which feature helps you find topics quickly?' LIMIT 1)
INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order) VALUES
  ((SELECT id FROM q), 'Glossary',          false, 1),
  ((SELECT id FROM q), 'Index',             false, 2),
  ((SELECT id FROM q), 'Table of contents', true,  3),
  ((SELECT id FROM q), 'Bibliography',      false, 4);

WITH q AS (SELECT id FROM quiz_questions WHERE question_text='The "setting" of a story refers to:' LIMIT 1)
INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order) VALUES
  ((SELECT id FROM q), 'The characters',                        false, 1),
  ((SELECT id FROM q), 'When and where the story takes place',  true,  2),
  ((SELECT id FROM q), 'The main problem',                      false, 3),
  ((SELECT id FROM q), 'The solution',                          false, 4);

WITH q AS (SELECT id FROM quiz_questions WHERE question_text='A supporting detail helps to:' LIMIT 1)
INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order) VALUES
  ((SELECT id FROM q), 'Contradict the main idea',          false, 1),
  ((SELECT id FROM q), 'Confuse the reader',                false, 2),
  ((SELECT id FROM q), 'Prove or explain the main idea',    true,  3),
  ((SELECT id FROM q), 'Start a new topic',                 false, 4);

-- =============================================================
-- DEMO USERS
-- After running this SQL, create these users in:
-- Supabase Dashboard → Authentication → Users → Add User
--
-- Email: layla@learnspark.me     Password: learn2025    (username: layla,     role: student)
-- Email: fatima@learnspark.me    Password: teach2025    (username: msfatima,  role: teacher)
-- Email: admin@learnspark.me     Password: admin2025    (username: admin,     role: admin)
--
-- The trigger above will auto-create a profile row.
-- Then manually set username/role in the profiles table via Table Editor.
-- =============================================================
