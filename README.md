# Community Connect

## Payment flow (UPI + phone + QR)

Residents can now:
- Pay through UPI deep links (GPay / PhonePe / Paytm / BHIM).
- Use the configured **receiver phone number**.
- Scan the configured **QR code**.
- Submit payment with a **mandatory UTR / transaction reference**.
- Optionally attach a **payment screenshot** as proof.

### Auto UTR capture
If the UPI app returns query parameters like `utr`, `txnRef`, `txnId`, or `ApprovalRefNo` back to the app URL, the UTR field auto-populates.
If not, residents must paste the UTR manually before submitting.

## How to change the app icon manually

### Web / PWA icon
1. Replace `public/favicon.ico`.
2. Replace any icon paths referenced in `public/manifest.webmanifest`.
3. Rebuild and redeploy.

### Android app icon (if you wrap this app in Android)
1. Replace launcher icons in:
   - `android/app/src/main/res/mipmap-*/ic_launcher.png`
   - `android/app/src/main/res/mipmap-*/ic_launcher_round.png`
2. Keep file names the same.
3. Rebuild the Android app.

### iOS app icon (if you wrap this app in iOS)
1. Open `ios/App/App/Assets.xcassets/AppIcon.appiconset`.
2. Replace all required icon sizes.
3. Rebuild the iOS app.

## Theme support
- Light and Dark themes are now switchable from the top app bar.

## What to do every time code changes (recommended workflow)

Follow this checklist for **every change**:

1. Pull latest code and install dependencies.
2. Run automated checks.
3. Run app locally and test only the impacted flow(s).
4. If backend schema changed, run/deploy migrations.
5. Build production bundle to catch compile-time issues.
6. Verify on phone/APK for mobile-specific behavior (notifications, deep-links, camera/QR).
7. Document what passed/failed.

### Commands to run

```bash
npm install
npm run test
npm run build
npm run lint
```

If Supabase migrations changed, apply them in your target project/environment before testing those features.

## Detailed test plan for this app

### A) Signup + phone validation
1. Go to Signup.
2. Enter fewer than 10 digits in Phone and submit → should show validation error.
3. Enter exactly 10 digits and submit → account creation should proceed.
4. Confirm phone stored in user metadata/profile as 10 digits.

### B) New signup notifications to admins
1. On an admin device/browser, login and enable notifications from Dashboard.
2. Confirm browser permission is **Allow**.
3. Create a new user signup from another account/device.
4. Admin should receive push: “New signup pending approval”.
5. If not received, verify:
   - Edge function `notify-admins-new-signup` is deployed.
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` are set.
   - Admin has a row in `push_subscriptions`.

### C) Payments (UPI/phone/QR + mandatory UTR)
1. Admin configures UPI ID, phone number, and QR URL in Admin Settings.
2. Resident opens “Pay maintenance”.
3. Verify all available payment options are shown.
4. Try recording payment without UTR → must be blocked.
5. Record payment with UTR and optional screenshot.
6. Verify entry appears in resident history and admin payment table (with proof link if attached).

### D) Theme + compact icon UI
1. Toggle dark/light icon in header.
2. Verify theme switches instantly and persists for next navigation.
3. Confirm header and bottom nav occupy less space and remain usable on smaller screens.
