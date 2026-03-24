# FenderGuard — what to edit

The **real app** (iOS / Android / web via Expo) lives in this folder — **not** in `preview.html`.

| What you want to change | Where |
|-------------------------|--------|
| Colors & light theme | `src/theme/colors.ts` |
| Main layout, header, Bluetooth modal | `App.tsx` |
| Speed / MPH toggle | `src/components/SpeedReadout.tsx` |
| Skateboard diagram & light controls | `src/components/SkateboardDiagram.tsx` |
| Demo motion / BLE transport | `src/protocol/mockDevice.ts`, `src/protocol/blePlxTransport.ts` |
| BLE UUIDs & payloads | `src/protocol/types.ts` |

`preview.html` is a **standalone browser mock** for quick demos. When you change the Expo app, update `preview.html` separately if you still want them to match.

### Run locally (no Xcode)

```bash
npm install
npm run preview    # opens preview.html
npm run web        # Expo in the browser
```

Native iOS builds still use Xcode + `npx expo run:ios` when you need Bluetooth on a real phone.
