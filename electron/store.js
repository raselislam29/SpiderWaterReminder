const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULT_STATE = {
  reminderText: 'Time to drink water',
  mode: 'atTime', // 'atTime' | 'repeat'
  alarmTime: '08:00', // HH:mm local
  intervalMinutes: 60,
  isActive: false,
  statusText: 'No reminder set',
  // Days the reminder may fire, 0=Sunday .. 6=Saturday. Defaults to every day.
  activeDays: [0, 1, 2, 3, 4, 5, 6],
  // Suppress reminders inside a window (may wrap past midnight).
  quietHoursEnabled: false,
  quietStart: '22:00',
  quietEnd: '07:00',
  // How long the drop stays on screen before dismissing itself.
  autoDismissSeconds: 20,
};

const AUTO_DISMISS_CHOICES = [10, 20, 30, 60];

/** Reject anything a hand-edited state file or an older version could contain. */
function normalizeState(state) {
  const next = { ...DEFAULT_STATE, ...state };

  const days = Array.isArray(next.activeDays)
    ? [...new Set(next.activeDays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
    : [];
  // An empty set would mean "never fire", which reads as a broken app.
  next.activeDays = days.length ? days.sort() : [...DEFAULT_STATE.activeDays];

  next.quietHoursEnabled = Boolean(next.quietHoursEnabled);
  next.quietStart = isHhMm(next.quietStart) ? next.quietStart : DEFAULT_STATE.quietStart;
  next.quietEnd = isHhMm(next.quietEnd) ? next.quietEnd : DEFAULT_STATE.quietEnd;
  next.alarmTime = isHhMm(next.alarmTime) ? next.alarmTime : DEFAULT_STATE.alarmTime;

  const secs = Number(next.autoDismissSeconds);
  next.autoDismissSeconds = AUTO_DISMISS_CHOICES.includes(secs)
    ? secs
    : DEFAULT_STATE.autoDismissSeconds;

  return next;
}

function isHhMm(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
}

function storePath() {
  return path.join(app.getPath('userData'), 'spider-water-reminder-state.json');
}

function loadState() {
  try {
    const raw = fs.readFileSync(storePath(), 'utf8');
    return normalizeState(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(state) {
  const next = normalizeState(state);
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

module.exports = { DEFAULT_STATE, AUTO_DISMISS_CHOICES, loadState, saveState, normalizeState };
