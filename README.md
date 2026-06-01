# LearnSpark – Grade 6 Learning Portal

A self-paced learning portal for Grade 6 students with quizzes, downloadable resources, progress tracking, and role-based access for students, teachers, and admins.

---

## File Structure

```
learnspark/
├── index.html          ← Login page
├── dashboard.html      ← Dashboard (all roles)
├── subject.html        ← Subject lessons + quiz (student)
├── progress.html       ← Progress tracker (student)
├── achievements.html   ← Badges (student)
├── teacher.html        ← Content manager (teacher)
├── students.html       ← Student progress view (teacher/admin)
├── admin.html          ← User role assignment (admin only)
├── css/
│   └── styles.css      ← All styles
├── js/
│   ├── supabase.js     ← Supabase client (put your keys here)
│   ├── auth.js         ← Login / logout / session
│   ├── data.js         ← All database reads and writes
│   ├── quiz.js         ← Quiz engine
│   └── utils.js        ← Shared helpers, sidebar, topbar
├── sql/
│   └── schema.sql      ← Paste into Supabase SQL editor to set up DB
└── .env.example        ← Shows what values you need
```

---

## Step 1 — Set up Supabase

1. Go to https://supabase.com and create a free account
2. Click **New Project**, give it a name (e.g. `learnspark`), set a strong DB password, choose a region close to you
3. Wait ~2 minutes for the project to spin up
4. Go to **SQL Editor** → **New Query**
5. Open `sql/schema.sql`, copy the entire contents, paste into the editor, click **Run**
6. You should see tables created: profiles, subjects, weeks, quiz_questions, etc.

---

## Step 2 — Create demo users in Supabase Auth

1. In your Supabase project go to **Authentication** → **Users** → **Add User**
2. Create these three users (use "Create User" not "Invite"):

| Email | Password |
|---|---|
| layla@learnspark.me | learn2025 |
| fatima@learnspark.me | teach2025 |
| admin@learnspark.me | admin2025 |

3. After creating each user, go to **Table Editor** → **profiles** table
4. Find each user's row (auto-created by the trigger) and set:

| Email | username | display_name | role |
|---|---|---|---|
| layla@learnspark.me | layla | Layla Al-Rashidi | student |
| fatima@learnspark.me | msfatima | Ms. Fatima Yousef | teacher |
| admin@learnspark.me | admin | Admin | admin |

---

## Step 3 — Add your Supabase keys to the project

1. In Supabase go to **Settings** → **API**
2. Copy your **Project URL** and **anon public** key
3. Open `js/supabase.js` and replace:

```js
const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
```

with your actual values.

---

## Step 4 — Set up Supabase Storage (for PDF downloads)

1. In Supabase go to **Storage** → **New Bucket**
2. Name it `resources`, set it to **Private** (signed URLs keep it secure)
3. Upload your PDF files. Recommended folder structure:
   ```
   resources/
   ├── math/week1/fractions-worksheet.pdf
   ├── math/week2/times-tables.pdf
   ├── sci/week1/body-systems-diagram.pdf
   └── eng/week1/reading-passage.pdf
   ```
4. In Supabase **Table Editor** → **resources** table, add a row for each file:
   - `week_id`: the UUID of the week it belongs to
   - `name`: display name (e.g. "Fractions Worksheet")
   - `file_type`: PDF
   - `icon`: 📄
   - `storage_path`: the path inside the bucket (e.g. `math/week1/fractions-worksheet.pdf`)

---

## Step 5 — Push to GitHub

```bash
cd learnspark
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/learnspark.git
git push -u origin main
```

---

## Step 6 — Deploy on DigitalOcean App Platform

1. Go to https://cloud.digitalocean.com/apps
2. Click **Create App** → **GitHub** → authorize and select your `learnspark` repo
3. DigitalOcean will detect it as a **Static Site** automatically
4. Set the output directory to `/` (root)
5. Click **Next** → **Next** → **Create Resources**
6. Your app will be live at a URL like `https://learnspark-xxxxx.ondigitalocean.app`

That's it. Every time you `git push`, DigitalOcean redeploys automatically.

---

## Step 7 — Point your custom domain (optional)

If you got a free `.me` domain from the GitHub Student Pack (Namecheap):

1. In DigitalOcean App Platform → your app → **Settings** → **Domains** → **Add Domain**
2. Enter your domain (e.g. `learnspark.me`)
3. DigitalOcean gives you a CNAME record to add in Namecheap
4. In Namecheap → **Advanced DNS** → add the CNAME record
5. Wait 10–30 minutes for DNS to propagate
6. HTTPS is handled automatically by DigitalOcean — no extra setup needed

---

## Adding more content (lessons, weeks, quizzes)

Everything is data-driven from Supabase. You never need to edit code to add content.

**Add a new week:**
- Table Editor → `weeks` → Insert row
- Fill in `subject_id`, `week_number`, `title`, `overview`

**Add objectives:**
- Table Editor → `learning_objectives` → Insert rows linked to the `week_id`

**Add quiz questions:**
- Table Editor → `quiz_questions` → Insert row with `week_id`
- Table Editor → `quiz_options` → Insert 4 rows linked to `question_id`, set one `is_correct = true`

**Add a resource file:**
- Upload PDF to Storage bucket → `resources/subject/weekN/filename.pdf`
- Table Editor → `resources` → Insert row with `storage_path`

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Plain HTML, CSS, JavaScript (no framework, no build step) |
| Auth | Supabase Auth (email + password) |
| Database | Supabase (PostgreSQL) |
| File storage | Supabase Storage |
| Hosting | DigitalOcean App Platform |
| Domain | Namecheap (via GitHub Student Pack) |

---

## Future features you can add

- Assignment submissions (add a `submissions` table + file upload)
- Parent accounts (add `parent` role to profiles)
- AI quiz generation (call Anthropic API from a Supabase Edge Function)
- Messaging between teacher and student (add a `messages` table)
- Attendance tracking (add an `attendance` table)
- Advanced analytics dashboard
- Multiple classes / organizations
