// js/data.js
// All database reads and writes go through this file.
// When you want to change how data is fetched, edit here — nowhere else.

// ── SUBJECTS ──

async function getSubjects() {
  const { data, error } = await sb.from('subjects').select('*').order('name');
  if (error) { console.error('getSubjects:', error); return []; }
  return data;
}

async function getSubjectBySlug(slug) {
  const { data, error } = await sb
    .from('subjects').select('*').eq('slug', slug).single();
  if (error) { console.error('getSubjectBySlug:', error); return null; }
  return data;
}

// ── WEEKS / LESSONS ──

async function getWeeksBySubject(subjectId) {
  const { data, error } = await sb
    .from('weeks')
    .select('*')
    .eq('subject_id', subjectId)
    .order('week_number');
  if (error) { console.error('getWeeksBySubject:', error); return []; }
  return data;
}

async function getWeek(weekId) {
  const { data, error } = await sb
    .from('weeks').select('*').eq('id', weekId).single();
  if (error) { console.error('getWeek:', error); return null; }
  return data;
}

async function getLearningObjectives(weekId) {
  const { data, error } = await sb
    .from('learning_objectives')
    .select('*').eq('week_id', weekId).order('sort_order');
  if (error) { console.error('getLearningObjectives:', error); return []; }
  return data;
}

// ── RESOURCES ──

async function getResources(weekId) {
  const { data, error } = await sb
    .from('resources')
    .select('*').eq('week_id', weekId).order('sort_order');
  if (error) { console.error('getResources:', error); return []; }
  return data;
}

// Get a signed download URL for a file in Supabase Storage
async function getDownloadUrl(storagePath) {
  const { data, error } = await sb.storage
    .from('resources')
    .createSignedUrl(storagePath, 60 * 60); // 1 hour expiry
  if (error) { console.error('getDownloadUrl:', error); return null; }
  return data.signedUrl;
}

// ── QUIZ ──

async function getQuizQuestions(weekId) {
  const { data, error } = await sb
    .from('quiz_questions')
    .select('*, quiz_options(*)')
    .eq('week_id', weekId)
    .order('sort_order');
  if (error) { console.error('getQuizQuestions:', error); return []; }
  return data;
}

// ── PROGRESS ──

async function getProgress(userId) {
  const { data, error } = await sb
    .from('student_progress')
    .select('*, subjects(name, slug, icon)')
    .eq('user_id', userId);
  if (error) { console.error('getProgress:', error); return []; }
  return data;
}

async function upsertProgress(userId, subjectId, fields) {
  const { error } = await sb.from('student_progress').upsert({
    user_id: userId,
    subject_id: subjectId,
    ...fields,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,subject_id' });
  if (error) console.error('upsertProgress:', error);
}

async function markLessonComplete(userId, weekId) {
  const { error } = await sb.from('completed_lessons').upsert({
    user_id: userId,
    week_id: weekId,
    completed_at: new Date().toISOString(),
  }, { onConflict: 'user_id,week_id' });
  if (error) console.error('markLessonComplete:', error);
}

async function getCompletedLessons(userId) {
  const { data, error } = await sb
    .from('completed_lessons')
    .select('week_id')
    .eq('user_id', userId);
  if (error) { console.error('getCompletedLessons:', error); return []; }
  return data.map(r => r.week_id);
}

// ── QUIZ RESULTS ──

async function saveQuizResult(userId, weekId, score, total) {
  const { error } = await sb.from('quiz_results').insert({
    user_id: userId,
    week_id: weekId,
    score,
    total_questions: total,
    percentage: Math.round((score / total) * 100),
    taken_at: new Date().toISOString(),
  });
  if (error) console.error('saveQuizResult:', error);
}

async function getQuizResults(userId) {
  const { data, error } = await sb
    .from('quiz_results')
    .select('*, weeks(week_number, title, subjects(name, slug))')
    .eq('user_id', userId)
    .order('taken_at', { ascending: false });
  if (error) { console.error('getQuizResults:', error); return []; }
  return data;
}

async function getBestQuizScore(userId, weekId) {
  const { data, error } = await sb
    .from('quiz_results')
    .select('percentage')
    .eq('user_id', userId)
    .eq('week_id', weekId)
    .order('percentage', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { console.error('getBestQuizScore:', error); return null; }
  return data ? data.percentage : null;
}

// ── BADGES ──

async function getBadges(userId) {
  const { data, error } = await sb
    .from('earned_badges')
    .select('badge_id')
    .eq('user_id', userId);
  if (error) { console.error('getBadges:', error); return []; }
  return data.map(r => r.badge_id);
}

async function awardBadge(userId, badgeId) {
  const { error } = await sb.from('earned_badges').upsert({
    user_id: userId,
    badge_id: badgeId,
    earned_at: new Date().toISOString(),
  }, { onConflict: 'user_id,badge_id' });
  if (error) console.error('awardBadge:', error);
}

// ── USERS (admin/teacher) ──

async function getAllProfiles() {
  const { data, error } = await sb
    .from('profiles')
    .select('id, username, display_name, role, grade, created_at')
    .order('role').order('display_name');
  if (error) { console.error('getAllProfiles:', error); return []; }
  return data;
}

async function updateUserRole(userId, newRole) {
  const { error } = await sb
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId);
  if (error) { console.error('updateUserRole:', error); return false; }
  return true;
}

async function getAllStudentProgress() {
  const { data, error } = await sb
    .from('profiles')
    .select(`
      id, username, display_name, grade,
      student_progress(subject_id, percent_complete, subjects(name, slug)),
      quiz_results(percentage, taken_at)
    `)
    .eq('role', 'student');
  if (error) { console.error('getAllStudentProgress:', error); return []; }
  return data;
}
