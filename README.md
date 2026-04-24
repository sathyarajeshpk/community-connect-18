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
