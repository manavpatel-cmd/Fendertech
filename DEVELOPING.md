# FenderGuard — what to edit

The **real app** (iOS / Android / web via Expo) lives in this folder — **not** in `preview.html`.

| What you want to change | Where |
|-------------------------|--------|
| Colors & theme (light) | `src/theme/colors.ts` |
| Main layout, header, Bluetooth modal | `App.tsx` |
| Speed / MPH toggle | `src/components/SpeedReadout.tsx` |
| Skateboard diagram & light controls | `src/components/SkateboardDiagram.tsx` |
| Demo motion / BLE transport | `src/protocol/mockDevice.ts`, `src/protocol/blePlxTransport.ts` |
| BLE UUIDs & payloads | `src/protocol/types.ts` |
| Animated stunt splash + tagline | `src/components/SplashStunt.tsx` |
| App icon & static splash image | `assets/icon.png`, `assets/splash-icon.png`, `app.json` |

**Home screen icon still grey/white?** The PNG in `assets/` is correct only after you regenerate native assets and reinstall: `npx expo prebuild --platform ios`, then open `ios/*.xcworkspace` in Xcode and **Run** on your iPhone (delete the old app first if the icon is cached). The `ios/` folder is gitignored locally; an old Xcode project opened from another folder will keep the default placeholder icon.

`preview.html` is a **standalone browser mock** for quick demos. It is kept aligned with the app theme (light) and mirrors speed-unit persistence via `localStorage` (`fenderguard-preview-unit`), while the app uses `@react-native-async-storage/async-storage` (`@fenderguard/speedUnit`).

### Run locally (no Xcode)

```bash
npm install
npm run preview    # opens preview.html
npm run web        # Expo in the browser
```

Native iOS builds still use Xcode + `npx expo run:ios` when you need Bluetooth on a real phone.
