# SpiderWaterReminder (Windows)

Tray water-reminder app with Spider-Man drop overlay (Electron).

## Run locally

```bash
npm install
npm start
```

Click the tray icon near the clock. **Test** previews the drop. Right-click tray → Quit.

## Ship to other people

```bash
npm run dist
```

Outputs in `dist/`:
- `SpiderWaterReminder-1.0.0-Setup.exe` — installer
- `SpiderWaterReminder-1.0.0-Portable.exe` — portable

Users download → install/run → open from Start Menu → use the tray icon.
