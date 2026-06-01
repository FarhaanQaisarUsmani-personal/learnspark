// js/quiz.js
// Self-contained quiz engine. Call initQuiz(weekId, userId) to start.

let quizState = {
  questions: [],
  current: 0,
  score: 0,
  selected: null,
  answered: false,
  done: false,
  weekId: null,
  userId: null,
};

async function initQuiz(weekId, userId, containerEl) {
  quizState = { questions: [], current: 0, score: 0, selected: null, answered: false, done: false, weekId, userId };

  const questions = await getQuizQuestions(weekId);
  if (!questions.length) {
    containerEl.innerHTML = '<p style="color:var(--tx3);font-size:14px">No quiz questions found for this week.</p>';
    return;
  }
  quizState.questions = questions;
  renderQuiz(containerEl);
}

function renderQuiz(containerEl) {
  if (quizState.done) {
    renderScore(containerEl);
    return;
  }

  const q = quizState.questions[quizState.current];
  const opts = q.quiz_options || [];
  const total = quizState.questions.length;

  containerEl.innerHTML = `
    <button class="btn btn-outline btn-sm" id="quiz-exit" style="margin-bottom:18px">✕ Exit quiz</button>
    <div style="font-weight:800;font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">
      Question ${quizState.current + 1} of ${total}
    </div>
    <div style="display:flex;align-items:center;gap:5px;margin-bottom:18px">
      ${quizState.questions.map((_, i) => `
        <span class="q-dot ${i < quizState.current ? 'done' : i === quizState.current ? 'current' : ''}"></span>
      `).join('')}
    </div>
    <div style="font-weight:900;font-size:17px;color:var(--tx);line-height:1.45;margin-bottom:18px">${q.question_text}</div>
    <div id="options">
      ${opts.map((opt, i) => `
        <button class="quiz-opt" data-opt="${i}" data-correct="${opt.is_correct}">
          ${String.fromCharCode(65 + i)}. ${opt.option_text}
        </button>
      `).join('')}
    </div>
    <div id="feedback" style="display:none" class="quiz-feedback"></div>
    <div id="quiz-next-wrap" style="margin-top:4px;display:none">
      <button class="btn btn-primary" id="quiz-next">
        ${quizState.current < total - 1 ? 'Next Question →' : 'See Results 🎉'}
      </button>
    </div>
    <p id="quiz-hint" style="font-size:12px;color:var(--tx3);margin-top:8px">Select an answer above to continue.</p>
  `;

  // Exit
  containerEl.querySelector('#quiz-exit').addEventListener('click', () => {
    if (confirm('Exit the quiz? Your progress will be lost.')) {
      window.location.reload();
    }
  });

  // Option selection
  containerEl.querySelectorAll('.quiz-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      if (quizState.answered) return;

      const idx = parseInt(btn.dataset.opt);
      const isCorrect = btn.dataset.correct === 'true';
      quizState.selected = idx;
      quizState.answered = true;
      if (isCorrect) quizState.score++;

      // Style all options
      containerEl.querySelectorAll('.quiz-opt').forEach((b, i) => {
        b.classList.add('disabled');
        if (b.dataset.correct === 'true') b.classList.add('correct');
        else if (i === idx) b.classList.add('wrong');
      });

      // Show feedback
      const fb = containerEl.querySelector('#feedback');
      fb.style.display = 'block';
      if (isCorrect) {
        fb.classList.add('correct');
        fb.textContent = '✅ Correct! Well done!';
      } else {
        fb.classList.add('wrong');
        const correctOpt = opts.find(o => o.is_correct);
        fb.textContent = `❌ The correct answer is: ${correctOpt ? correctOpt.option_text : '—'}`;
      }

      containerEl.querySelector('#quiz-hint').style.display = 'none';
      containerEl.querySelector('#quiz-next-wrap').style.display = 'block';
    });
  });

  // Next question
  containerEl.querySelector('#quiz-next')?.addEventListener('click', () => {
    if (quizState.current < quizState.questions.length - 1) {
      quizState.current++;
      quizState.answered = false;
      quizState.selected = null;
      renderQuiz(containerEl);
    } else {
      quizState.done = true;
      handleQuizComplete(containerEl);
    }
  });
}

async function handleQuizComplete(containerEl) {
  const total = quizState.questions.length;
  const pct = Math.round((quizState.score / total) * 100);

  // Save to DB
  await saveQuizResult(quizState.userId, quizState.weekId, quizState.score, total);
  await markLessonComplete(quizState.userId, quizState.weekId);

  // Award badges
  const earned = await getBadges(quizState.userId);
  if (!earned.includes('first_quiz')) await awardBadge(quizState.userId, 'first_quiz');
  if (pct >= 80 && !earned.includes('week_warrior')) await awardBadge(quizState.userId, 'week_warrior');
  if (pct === 100 && !earned.includes('perfect_score')) await awardBadge(quizState.userId, 'perfect_score');

  renderScore(containerEl);
}

function renderScore(containerEl) {
  const total = quizState.questions.length;
  const pct = Math.round((quizState.score / total) * 100);
  const gradeClass = pct >= 80 ? 'score-a' : pct >= 60 ? 'score-b' : 'score-c';
  const gradeLabel = pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good job!' : 'Keep going!';
  const gradeMsg = pct >= 80
    ? 'Outstanding — you really know this material! 🌟'
    : pct >= 60
    ? 'Solid effort. Review the ones you missed and try again. 💪'
    : 'Review the lesson carefully and try again. You can do this! 📖';

  containerEl.innerHTML = `
    <div class="card score-card">
      <div class="score-circle ${gradeClass}">${pct}%</div>
      <div class="score-title">${gradeLabel}</div>
      <div class="score-msg">${gradeMsg}</div>
      <div class="score-stats">
        <div class="score-stat">
          <div class="score-stat-val">${quizState.score}/${total}</div>
          <div class="score-stat-lbl">Correct</div>
        </div>
        <div class="score-stat">
          <div class="score-stat-val">${pct}%</div>
          <div class="score-stat-lbl">Score</div>
        </div>
      </div>
      <div style="display:flex;gap:9px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary" id="score-back">Back to lessons</button>
        <button class="btn btn-outline" id="score-retry">Retry quiz</button>
      </div>
    </div>
  `;

  containerEl.querySelector('#score-back').addEventListener('click', () => {
    window.location.reload();
  });
  containerEl.querySelector('#score-retry').addEventListener('click', async () => {
    quizState.current = 0;
    quizState.score = 0;
    quizState.selected = null;
    quizState.answered = false;
    quizState.done = false;
    renderQuiz(containerEl);
  });
}
