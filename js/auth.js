// js/auth.js
// Handles login, logout, and session persistence

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  if (!form) return;

  // Role selector auto-fills demo credentials
  const roleBtns = document.querySelectorAll('.role-btn');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const errorMsg = document.getElementById('error-msg');

  const demoCreds = {
    student: { username: 'layla', password: 'learn2025' },
    teacher: { username: 'msfatima', password: 'teach2025' },
    admin:   { username: 'admin',   password: 'admin2025' },
  };

  roleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      roleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const role = btn.dataset.role;
      usernameInput.value = demoCreds[role].username;
      passwordInput.value = demoCreds[role].password;
      errorMsg.style.display = 'none';
    });
  });

  // Login form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.style.display = 'none';

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showError('Please enter your username and password.');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Signing in…';
    submitBtn.disabled = true;

    try {
      // Look up the user's email by username from profiles table
      const { data: profile, error: lookupError } = await sb
        .from('profiles')
        .select('email')
        .eq('username', username)
        .single();

      if (lookupError || !profile) {
        showError('Username not found.');
        return;
      }

      // Sign in with Supabase Auth using email + password
      const { error: authError } = await sb.auth.signInWithPassword({
        email: profile.email,
        password: password,
      });

      if (authError) {
        showError('Incorrect username or password.');
        return;
      }

      // Get full profile to determine redirect
      const user = await getSessionUser();
      if (!user) { showError('Could not load your profile.'); return; }

      // Redirect based on role
      if (user.role === 'admin') window.location.href = 'admin.html';
      else if (user.role === 'teacher') window.location.href = 'dashboard.html';
      else window.location.href = 'dashboard.html';

    } catch (err) {
      console.error(err);
      showError('Something went wrong. Please try again.');
    } finally {
      submitBtn.textContent = 'Sign In';
      submitBtn.disabled = false;
    }
  });

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  }
});

// ── Logout (called from any page) ──
async function logout() {
  await sb.auth.signOut();
  window.location.href = 'index.html';
}
