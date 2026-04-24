# Community Connect — Beginner Guide (Step by Step)

This README is written for a **non-technical / beginner** workflow.
If you follow these steps exactly, you can safely make, test, and merge changes.

---

## 0) What you need installed first (one-time setup)

- **Git** (for branches/commits)
- **Node.js 20+** and **npm**
- Access to your **Supabase project** (URL + anon key + service role key for admin tasks)
- A code editor (VS Code recommended)

### Check installation
Open terminal and run:

```bash
git --version
node --version
npm --version
```

If these commands show versions, you are ready.

---

## 1) Daily workflow overview (simple words)

Every task should follow this order:

1. Get latest code
2. Create a new branch
3. Make changes
4. Test changes
5. Commit changes
6. Push branch
7. Create Pull Request (PR)
8. Get review + fix comments
9. Merge PR

---

## 2) Exact Git commands (copy-paste)

### Step A — go to project folder
```bash
cd /path/to/community-connect-18
```

### Step B — get latest main branch
```bash
git checkout main
git pull origin main
```

### Step C — create your working branch
Use a meaningful branch name:
```bash
git checkout -b fix/signup-phone-validation
```

> Rule: Do **not** work directly on `main`.

---

## 3) Install dependencies and run app locally

### First time (or after pulling new code)
```bash
npm install
```

### Start local app
```bash
npm run dev
```

- Open the shown URL (usually `http://localhost:5173`)
- Keep terminal open while testing UI

---

## 4) Where to run tests, what to run, and when to run

Run all commands from the **project root folder** (same folder as `package.json`).

### A) Unit tests
Run after logic/code changes:
```bash
npm run test
```

### B) Production build check
Run before every commit/PR:
```bash
npm run build
```

### C) Lint check (code quality)
Run before every PR:
```bash
npm run lint
```

### When exactly should you run these?
- After finishing coding a task
- Again before committing
- Again after fixing review comments

Minimum expected before PR:
- `npm run test`
- `npm run build`
- `npm run lint` (or document why failing)

---

## 5) Manual testing checklist (non-technical)

After `npm run dev`, test in browser like a normal user.

### Signup flow
- Try wrong phone (less than 10 digits) → should show error
- Try valid phone (exactly 10 digits) → signup should continue

### Payment flow
- Open payment screen
- Check if UPI options appear
- Check phone/QR options if configured by admin
- Try submit without UTR → should block
- Add UTR and submit → should save

### Admin payment review
- Open admin payments page
- Verify payment appears
- Verify proof/screenshot link opens if uploaded

### Theme/UI
- Toggle dark/light
- Confirm app still usable on small phone screen

### Notifications
- Admin enables notifications on device
- New user signs up from another account/device
- Admin should receive push notification

---

## 6) Supabase changes: how to test safely

If your change includes files in `supabase/migrations/...` or `supabase/functions/...`, do this:

### A) Apply migration in target environment
Use your normal Supabase deployment process (CLI or dashboard pipeline).

If using CLI example:
```bash
supabase db push
```

### B) Deploy edge functions (if changed)
Example:
```bash
supabase functions deploy notify-admins-new-signup
supabase functions deploy push-subscribe
supabase functions deploy push-public-key
```

### C) Verify required secrets (important)
For notifications, check these are set in Supabase project secrets:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

### D) Supabase-specific test checks
- New migration columns/tables exist
- RLS policies behave correctly (authorized allowed, unauthorized blocked)
- Edge function runs successfully in logs

---

## 7) Commit properly (after tests pass)

### See changed files
```bash
git status
```

### Add files
```bash
git add .
```

### Commit with clear message
```bash
git commit -m "Fix signup phone validation and notification trigger"
```

Good commit message examples:
- `Fix signup 10-digit phone validation`
- `Add payment proof upload and admin proof links`
- `Refine compact mobile navigation icons`

---

## 8) Push branch and create PR

### Push branch
```bash
git push -u origin fix/signup-phone-validation
```

### Create Pull Request
On GitHub:
1. Open repository
2. Click **Compare & pull request**
3. Title: short and clear
4. Description must include:
   - What changed
   - Why changed
   - How tested (commands + manual checks)
   - Any known issues

---

## 9) How to handle review comments

If reviewer asks for changes:

1. Stay on same branch
2. Make fixes
3. Re-run tests/build/lint
4. Commit again
5. Push again

Commands:
```bash
git add .
git commit -m "Address PR review comments"
git push
```

PR updates automatically.

---

## 10) Merge process (after approval)

After PR approved:
1. Click **Merge pull request**
2. Choose merge method used by your team (usually Squash and merge)
3. Delete branch on GitHub (optional but recommended)

Then locally clean up:
```bash
git checkout main
git pull origin main
git branch -d fix/signup-phone-validation
```

---

## 11) How to change app icon (very simple)

There are **3 possible app types**. Use the section that matches your app.

### A) Web/PWA icon
- Replace file: `public/favicon.ico`
- Check `public/manifest.webmanifest` icon paths
- Rebuild and redeploy

### B) Android app icon (APK)
- Replace launcher files in Android project:
  - `android/app/src/main/res/mipmap-*/ic_launcher.png`
  - `android/app/src/main/res/mipmap-*/ic_launcher_round.png`
- Keep same file names
- Rebuild APK

### C) iOS app icon
- Open: `ios/App/App/Assets.xcassets/AppIcon.appiconset`
- Replace all required icon sizes
- Rebuild iOS app

---

## 12) Quick “before PR” checklist

- [ ] I created a branch (not using main)
- [ ] App runs locally (`npm run dev`)
- [ ] Tests run (`npm run test`)
- [ ] Build passes (`npm run build`)
- [ ] Lint checked (`npm run lint`)
- [ ] Manual checks done for changed feature
- [ ] Supabase migration/function deployed/tested (if relevant)
- [ ] Commit message is clear
- [ ] PR description includes testing details

---

## 13) If something fails, what to do

- Copy exact error from terminal
- Note which command failed
- Do **not** merge until issue is understood
- Add failure note in PR description if temporarily unavoidable

---

If you want, next I can also add:
1. A one-click script for all checks (`npm run check-all`), and
2. A PR template so every PR has the same testing format automatically.
