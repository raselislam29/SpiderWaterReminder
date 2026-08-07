const $ = (id) => document.getElementById(id);

const messageEl = $('message');
const alarmTimeEl = $('alarmTime');
const intervalEl = $('interval');
const statusEl = $('status');
const activeToggle = $('activeToggle');
const toggleLabel = $('toggleLabel');
const atTimePanel = $('atTimePanel');
const repeatPanel = $('repeatPanel');
const daysEl = $('days');
const quietToggle = $('quietToggle');
const quietPanel = $('quietPanel');
const quietStartEl = $('quietStart');
const quietEndEl = $('quietEnd');
const quietHintEl = $('quietHint');
const dismissSeg = $('dismissSeg');
const templatesEl = $('templates');
const setBtn = $('setBtn');
const toastEl = $('toast');

const modeButtons = [...document.querySelectorAll('.seg-btn[data-mode]')];
const dismissButtons = [...dismissSeg.querySelectorAll('.seg-btn[data-seconds]')];
const templateButtons = [...templatesEl.querySelectorAll('.chip[data-template]')];
const dayPresetButtons = [...document.querySelectorAll('[data-days]')];

/**
 * A template is a whole reminder, not just a phrase: picking one sets the
 * message and the schedule that actually suits it. Lunch is a clock event,
 * hydration and posture are intervals.
 */
const TEMPLATES = {
  water: { reminderText: 'Time to drink water', mode: 'repeat', intervalMinutes: 45 },
  lunch: { reminderText: 'Lunch break', mode: 'atTime', alarmTime: '13:00' },
  email: { reminderText: 'Check email', mode: 'repeat', intervalMinutes: 120 },
  stand: { reminderText: 'Stand up and stretch', mode: 'repeat', intervalMinutes: 60 },
  eyes: { reminderText: 'Look away and rest your eyes', mode: 'repeat', intervalMinutes: 20 },
};

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const shellEl = document.querySelector('.shell');

let mode = 'atTime';
let activeDays = [0, 1, 2, 3, 4, 5, 6];
let autoDismissSeconds = 20;
let toastTimer = null;
let buttonTimer = null;

/**
 * Sections open and close (repeat interval, quiet hours) and the template chips
 * rewrap at different widths, so the window height is measured rather than
 * assumed. Main clamps the result to the work area.
 */
let heightFrame = null;
function reportHeight() {
  if (heightFrame) cancelAnimationFrame(heightFrame);
  heightFrame = requestAnimationFrame(() => {
    heightFrame = null;
    window.swr.reportHeight?.(shellEl.scrollHeight);
  });
}

/* Days -------------------------------------------------------------------- */

DAY_LABELS.forEach((label, index) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'day';
  btn.textContent = label;
  btn.dataset.day = String(index);
  btn.setAttribute('aria-pressed', 'false');
  btn.setAttribute('aria-label', DAY_NAMES[index]);
  btn.addEventListener('click', () => toggleDay(index));
  daysEl.appendChild(btn);
});

function renderDays() {
  [...daysEl.children].forEach((btn) => {
    const on = activeDays.includes(Number(btn.dataset.day));
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

function toggleDay(index) {
  if (activeDays.includes(index)) {
    // Clearing the last day would mean "never fire", which reads as a bug.
    if (activeDays.length === 1) {
      showToast('Keep at least one day');
      return;
    }
    activeDays = activeDays.filter((d) => d !== index);
  } else {
    activeDays = [...activeDays, index].sort((a, b) => a - b);
  }
  renderDays();
}

dayPresetButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    activeDays = btn.dataset.days === 'weekdays' ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
    renderDays();
  });
});

/* Mode, quiet hours, dismiss ---------------------------------------------- */

function setMode(next) {
  mode = next === 'repeat' ? 'repeat' : 'atTime';
  modeButtons.forEach((btn) => {
    const on = btn.dataset.mode === mode;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', String(on));
  });
  atTimePanel.classList.toggle('hidden', mode !== 'atTime');
  repeatPanel.classList.toggle('hidden', mode !== 'repeat');
  reportHeight();
}

modeButtons.forEach((btn) => {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

function renderQuiet() {
  const on = quietToggle.checked;
  quietPanel.classList.toggle('hidden', !on);
  quietHintEl.textContent = on
    ? `Silent from ${formatTime(quietStartEl.value)} to ${formatTime(quietEndEl.value)}.`
    : 'Reminders can fire at any hour.';
  reportHeight();
}

quietToggle.addEventListener('change', renderQuiet);
quietStartEl.addEventListener('change', renderQuiet);
quietEndEl.addEventListener('change', renderQuiet);

function setDismissSeconds(seconds) {
  autoDismissSeconds = Number(seconds) || 20;
  dismissButtons.forEach((btn) => {
    const on = Number(btn.dataset.seconds) === autoDismissSeconds;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

dismissButtons.forEach((btn) => {
  btn.addEventListener('click', () => setDismissSeconds(btn.dataset.seconds));
});

/* Templates --------------------------------------------------------------- */

function markMatchingTemplate() {
  const text = messageEl.value.trim().toLowerCase();
  templateButtons.forEach((btn) => {
    const preset = TEMPLATES[btn.dataset.template];
    btn.classList.toggle('active', Boolean(preset) && preset.reminderText.toLowerCase() === text);
  });
}

templateButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const preset = TEMPLATES[btn.dataset.template];
    if (!preset) return;
    messageEl.value = preset.reminderText;
    setMode(preset.mode);
    if (preset.mode === 'repeat') {
      intervalEl.value = String(preset.intervalMinutes);
    } else {
      alarmTimeEl.value = preset.alarmTime;
    }
    markMatchingTemplate();
    messageEl.focus();
  });
});

messageEl.addEventListener('input', markMatchingTemplate);
messageEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') setBtn.click();
});

/* State ------------------------------------------------------------------- */

function collectPartial() {
  return {
    reminderText: messageEl.value.trim() || 'Time to drink water',
    mode,
    alarmTime: alarmTimeEl.value || '08:00',
    intervalMinutes: Number(intervalEl.value) || 60,
    activeDays,
    quietHoursEnabled: quietToggle.checked,
    quietStart: quietStartEl.value || '22:00',
    quietEnd: quietEndEl.value || '07:00',
    autoDismissSeconds,
  };
}

function formatTime(hhmm) {
  const [hRaw, mRaw] = String(hhmm || '08:00').split(':');
  let h = parseInt(hRaw, 10);
  const m = parseInt(mRaw, 10) || 0;
  if (Number.isNaN(h)) return hhmm;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

function paintStatus(text) {
  const value = text || 'No reminder set';
  statusEl.textContent = value;
  statusEl.classList.toggle('active', !/^No reminder|^Never fires/.test(value));
  statusEl.classList.toggle('warn', value.startsWith('Never fires'));
}

function showToast(message) {
  toastEl.hidden = false;
  toastEl.textContent = message;
  requestAnimationFrame(() => toastEl.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => {
      toastEl.hidden = true;
    }, 200);
  }, 2200);
}

function flashSavedButton() {
  setBtn.textContent = 'Saved';
  setBtn.classList.add('saved');
  clearTimeout(buttonTimer);
  buttonTimer = setTimeout(() => {
    setBtn.textContent = 'Set Reminder';
    setBtn.classList.remove('saved');
  }, 1800);
}

function renderState(state, { celebrate = false } = {}) {
  if (!state) return;

  messageEl.value = state.reminderText || '';
  alarmTimeEl.value = state.alarmTime || '08:00';
  intervalEl.value = String(state.intervalMinutes || 60);
  setMode(state.mode);

  activeDays = Array.isArray(state.activeDays) && state.activeDays.length
    ? [...state.activeDays].sort((a, b) => a - b)
    : [0, 1, 2, 3, 4, 5, 6];
  renderDays();

  quietToggle.checked = Boolean(state.quietHoursEnabled);
  quietStartEl.value = state.quietStart || '22:00';
  quietEndEl.value = state.quietEnd || '07:00';
  renderQuiet();

  setDismissSeconds(state.autoDismissSeconds);
  markMatchingTemplate();
  paintStatus(state.statusText);

  activeToggle.checked = Boolean(state.isActive);
  toggleLabel.textContent = state.isActive ? 'On' : 'Off';

  if (celebrate && state.isActive) {
    statusEl.classList.remove('flash');
    void statusEl.offsetWidth; // restart the pulse
    statusEl.classList.add('flash');
    showToast(state.statusText || 'Reminder saved');
    flashSavedButton();
  }
}

setBtn.addEventListener('click', async () => {
  setBtn.disabled = true;
  try {
    const state = await window.swr.setReminder(collectPartial());
    renderState(state, { celebrate: true });
  } finally {
    setBtn.disabled = false;
  }
});

$('clearBtn').addEventListener('click', async () => {
  const state = await window.swr.clearReminder();
  renderState(state);
  showToast('Reminder cleared');
});

$('testBtn').addEventListener('click', async () => {
  await window.swr.setState(collectPartial());
  await window.swr.testReminder();
});

activeToggle.addEventListener('change', async () => {
  // Carry any unsaved edits over so the switch never arms a stale schedule.
  const state = activeToggle.checked
    ? await window.swr.setReminder(collectPartial())
    : await window.swr.toggleActive(false);
  renderState(state, { celebrate: activeToggle.checked });
});

reportHeight();
window.swr.onState((state) => renderState(state));
window.swr.onStatusTick((statusText) => paintStatus(statusText));
window.swr.getState().then((state) => renderState(state));
