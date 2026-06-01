// js/data.js
// All database reads and writes go through this file.

// ── SUBJECTS ──
async function getSubjects() {
  const { data, error } = await sb.from('subjects').select('*').order('sort_order');
  if (error) { console.error('getSubjects:', error); return []; }
  return data;
}
async function getSubjectBySlug(slug) {
  const { data, error } = await sb.from('subjects').select('*').eq('slug', slug).single();
  if (error) { console.error('getSubjectBySlug:', error); return null; }
  return data;
}

// ── WEEKS ──
async function getWeeksBySubject(subjectId) {
  const { data, error } = await sb.from('weeks').select('*').eq('subject_id', subjectId).order('week_number');
  if (error) { console.error('getWeeksBySubject:', error); return []; }
  return data;
}
async function getWeek(weekId) {
  const { data, error } = await sb.from('weeks').select('*').eq('id', weekId).single();
  if (error) { console.error('getWeek:', error); return null; }
  return data;
}
async function updateWeek(weekId, fields) {
  const { error } = await sb.from('weeks').update(fields).eq('id', weekId);
  if (error) { console.error('updateWeek:', error); return false; }
  return true;
}
async function insertWeek(subjectId, weekNumber, title) {
  const { data, error } = await sb.from('weeks').insert({
    subject_id: subjectId, week_number: weekNumber, title,
    overview: '', lesson_body: ''
  }).select().single();
  if (error) { console.error('insertWeek:', error); return null; }
  return data;
}
async function deleteWeek(weekId) {
  const { error } = await sb.from('weeks').delete().eq('id', weekId);
  if (error) { console.error('deleteWeek:', error); return false; }
  return true;
}

// ── OBJECTIVES ──
async function getLearningObjectives(weekId) {
  const { data, error } = await sb.from('learning_objectives').select('*').eq('week_id', weekId).order('sort_order');
  if (error) { console.error('getLearningObjectives:', error); return []; }
  return data;
}
async function insertObjective(weekId, text, sortOrder) {
  const { data, error } = await sb.from('learning_objectives').insert({
    week_id: weekId, objective_text: text, sort_order: sortOrder
  }).select().single();
  if (error) { console.error('insertObjective:', error); return null; }
  return data;
}
async function updateObjective(id, text) {
  const { error } = await sb.from('learning_objectives').update({ objective_text: text }).eq('id', id);
  if (error) { console.error('updateObjective:', error); return false; }
  return true;
}
async function deleteObjective(id) {
  const { error } = await sb.from('learning_objectives').delete().eq('id', id);
  if (error) { console.error('deleteObjective:', error); return false; }
  return true;
}

// ── RESOURCES ──
async function getResources(weekId) {
  const { data, error } = await sb.from('resources').select('*').eq('week_id', weekId).order('sort_order');
  if (error) { console.error('getResources:', error); return []; }
  return data;
}
async function insertResource(weekId, name, fileType, icon, storagePath, sortOrder) {
  const { data, error } = await sb.from('resources').insert({
    week_id: weekId, name, file_type: fileType, icon, storage_path: storagePath, sort_order: sortOrder
  }).select().single();
  if (error) { console.error('insertResource:', error); return null; }
  return data;
}
async function deleteResource(id, storagePath) {
  if (storagePath) {
    await sb.storage.from('resources').remove([storagePath]);
  }
  const { error } = await sb.from('resources').delete().eq('id', id);
  if (error) { console.error('deleteResource:', error); return false; }
  return true;
}
async function uploadResourceFile(file, weekSlug, weekNum) {
  // Sanitise filename — remove spaces and special chars
  const safeName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '');
  const path = `${weekSlug}/week${weekNum}/${Date.now()}-${safeName}`;

  // Check bucket exists first
  const { data: buckets, error: bucketErr } = await sb.storage.listBuckets();
  if (bucketErr) {
    console.error('Cannot list buckets — check anon key permissions:', bucketErr);
    throw new Error('Storage not accessible. Check your Supabase anon key.');
  }
  const bucketExists = buckets.some(b => b.name === 'resources');
  if (!bucketExists) {
    throw new Error('Storage bucket "resources" does not exist. Create it in Supabase → Storage → New Bucket.');
  }

  const { data, error } = await sb.storage.from('resources').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    console.error('uploadResourceFile:', error);
    // Surface the real Supabase error message
    throw new Error(error.message || 'Upload failed.');
  }
  return data.path;
}
async function getDownloadUrl(storagePath) {
  const { data, error } = await sb.storage.from('resources').createSignedUrl(storagePath, 3600);
  if (error) { console.error('getDownloadUrl:', error); return null; }
  return data.signedUrl;
}

// ── QUIZ ──
async function getQuizQuestions(weekId) {
  const { data, error } = await sb.from('quiz_questions')
    .select('*, quiz_options(*)')
    .eq('week_id', weekId)
    .order('sort_order');
  if (error) { console.error('getQuizQuestions:', error); return []; }
  // sort options by sort_order
  return data.map(q => ({ ...q, quiz_options: (q.quiz_options || []).sort((a,b) => a.sort_order - b.sort_order) }));
}
async function insertQuizQuestion(weekId, text, sortOrder) {
  const { data, error } = await sb.from('quiz_questions').insert({
    week_id: weekId, question_text: text, sort_order: sortOrder
  }).select().single();
  if (error) { console.error('insertQuizQuestion:', error); return null; }
  return data;
}
async function updateQuizQuestion(id, text) {
  const { error } = await sb.from('quiz_questions').update({ question_text: text }).eq('id', id);
  if (error) { console.error('updateQuizQuestion:', error); return false; }
  return true;
}
async function deleteQuizQuestion(id) {
  const { error } = await sb.from('quiz_questions').delete().eq('id', id);
  if (error) { console.error('deleteQuizQuestion:', error); return false; }
  return true;
}
async function insertQuizOption(questionId, text, isCorrect, sortOrder) {
  const { data, error } = await sb.from('quiz_options').insert({
    question_id: questionId, option_text: text, is_correct: isCorrect, sort_order: sortOrder
  }).select().single();
  if (error) { console.error('insertQuizOption:', error); return null; }
  return data;
}
async function updateQuizOption(id, text, isCorrect) {
  const { error } = await sb.from('quiz_options').update({ option_text: text, is_correct: isCorrect }).eq('id', id);
  if (error) { console.error('updateQuizOption:', error); return false; }
  return true;
}
async function deleteQuizOption(id) {
  const { error } = await sb.from('quiz_options').delete().eq('id', id);
  if (error) { console.error('deleteQuizOption:', error); return false; }
  return true;
}

// ── PROGRESS ──
async function getProgress(userId) {
  const { data, error } = await sb.from('student_progress')
    .select('*, subjects(name, slug, icon)').eq('user_id', userId);
  if (error) { console.error('getProgress:', error); return []; }
  return data;
}
async function upsertProgress(userId, subjectId, fields) {
  const { error } = await sb.from('student_progress').upsert({
    user_id: userId, subject_id: subjectId, ...fields, updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,subject_id' });
  if (error) console.error('upsertProgress:', error);
}
async function markLessonComplete(userId, weekId) {
  const { error } = await sb.from('completed_lessons').upsert({
    user_id: userId, week_id: weekId, completed_at: new Date().toISOString()
  }, { onConflict: 'user_id,week_id' });
  if (error) console.error('markLessonComplete:', error);
}
async function getCompletedLessons(userId) {
  const { data, error } = await sb.from('completed_lessons').select('week_id').eq('user_id', userId);
  if (error) { console.error('getCompletedLessons:', error); return []; }
  return data.map(r => r.week_id);
}

// ── QUIZ RESULTS ──
async function saveQuizResult(userId, weekId, score, total) {
  const { error } = await sb.from('quiz_results').insert({
    user_id: userId, week_id: weekId, score, total_questions: total,
    percentage: Math.round((score / total) * 100), taken_at: new Date().toISOString()
  });
  if (error) console.error('saveQuizResult:', error);
}
async function getQuizResults(userId) {
  const { data, error } = await sb.from('quiz_results')
    .select('*, weeks(week_number, title, subjects(name, slug))')
    .eq('user_id', userId).order('taken_at', { ascending: false });
  if (error) { console.error('getQuizResults:', error); return []; }
  return data;
}
async function getBestQuizScore(userId, weekId) {
  const { data, error } = await sb.from('quiz_results').select('percentage')
    .eq('user_id', userId).eq('week_id', weekId)
    .order('percentage', { ascending: false }).limit(1).maybeSingle();
  if (error) { console.error('getBestQuizScore:', error); return null; }
  return data ? data.percentage : null;
}

// ── BADGES ──
async function getBadges(userId) {
  const { data, error } = await sb.from('earned_badges').select('badge_id').eq('user_id', userId);
  if (error) { console.error('getBadges:', error); return []; }
  return data.map(r => r.badge_id);
}
async function awardBadge(userId, badgeId) {
  const { error } = await sb.from('earned_badges').upsert({
    user_id: userId, badge_id: badgeId, earned_at: new Date().toISOString()
  }, { onConflict: 'user_id,badge_id' });
  if (error) console.error('awardBadge:', error);
}

// ── USERS ──
async function getAllProfiles() {
  const { data, error } = await sb.from('profiles')
    .select('id, username, display_name, role, grade, created_at')
    .order('role').order('display_name');
  if (error) { console.error('getAllProfiles:', error); return []; }
  return data;
}
async function updateUserRole(userId, newRole) {
  const { error } = await sb.from('profiles').update({ role: newRole }).eq('id', userId);
  if (error) { console.error('updateUserRole:', error); return false; }
  return true;
}
async function getAllStudentProgress() {
  const { data, error } = await sb.from('profiles').select(`
    id, username, display_name, grade,
    student_progress(subject_id, percent_complete, subjects(name, slug)),
    quiz_results(percentage, taken_at, weeks(week_number, title, subjects(name,slug)))
  `).eq('role', 'student');
  if (error) { console.error('getAllStudentProgress:', error); return []; }
  return data;
}
