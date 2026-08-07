# SpiderWaterReminder

Tray reminder app for Windows and macOS by **Rasel Islam** (Electron). When a
reminder is due, the character drops down every connected screen at the same
moment and holds up your message.

## Run locally

```bash
npm install
npm start
```

Click the tray icon near the clock (menu bar on macOS). **Test** previews the
drop. Right-click the tray icon → Quit.

## What you can set

- **Message** — type your own, or pick a template: Drink Water, Lunch break,
  Check email, Stand up, Rest eyes. Each template also sets a schedule that
  suits it (lunch at 13:00, hydration every 45 min, and so on).
- **Schedule** — a fixed time of day, or a repeating interval from 1 minute to
  3 hours.
- **Days** — which weekdays the reminder may fire, with Every day / Weekdays
  shortcuts.
- **Quiet hours** — a window that silences reminders, including one that wraps
  past midnight such as 22:00 → 07:00.
- **Dismiss after** — how long the drop stays before it climbs away: 10s, 20s,
  30s or 1m. Clicking it or pressing Escape dismisses it early.

The status line under the controls shows the live countdown to the next drop,
and says so plainly when the days and quiet hours leave no slot at all.

## Ship

```bash
npm run dist       # Windows installer + portable
npm run dist:mac   # macOS dmg + zip (arm64 and x64) — must run on a Mac
```

Outputs in `dist/`:
- `SpiderWaterReminder-1.0.0-Setup.exe`
- `SpiderWaterReminder-1.0.0-Portable.exe`
- `SpiderWaterReminder-1.0.0-mac-arm64.dmg` / `-x64.dmg` (plus matching `.zip`)

Apple's toolchain only runs on macOS, so the Mac artifacts have to be built on a
Mac (or a macOS CI runner); `npm run dist:mac` on Windows will not produce them.
Both builds are unsigned, so Windows shows *More info → Run anyway* and macOS
needs a right-click → Open on first launch.

## Dev helpers

```bash
node tools/check-scheduler.js       # day / quiet-hour rules
npx electron tools/shoot-popup.js   # renders the popup to tools/popup-shot.png
```

## Author

Rasel Islam — https://github.com/raselislam29
