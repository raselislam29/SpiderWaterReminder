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
};

function storePath() {
  return path.join(app.getPath('userData'), 'spider-water-reminder-state.json');
}

function loadState() {
  try {
    const raw = fs.readFileSync(storePath(), 'utf8');
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(state) {
  const next = { ...DEFAULT_STATE, ...state };
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

module.exports = { DEFAULT_STATE, loadState, saveState };
