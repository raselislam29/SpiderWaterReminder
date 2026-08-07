const $ = (id) => document.getElementById(id);

const messageEl = $('message');
const alarmTimeEl = $('alarmTime');
const intervalEl = $('interval');
const statusEl = $('status');
const activeToggle = $('activeToggle');
const toggleLabel = $('toggleLabel');
const atTimePanel = $('atTimePanel');
const repeatPanel = $('repeatPanel');
const setBtn = $('setBtn');
const toastEl = $('toast');
const segButtons = [...document.querySelectorAll('.seg-btn')];

let mode = 'atTime';
let toastTimer = null;
let buttonTimer = null;

function collectPartial() {
  return {
    reminderText: messageEl.value.trim() || 'Time to drink water! 💧',
    mode,
    alarmTime: alarmTimeEl.value || '08:00',
    intervalMinutes: Number(intervalEl.value) || 60,
  };
}

function setMode(next) {
  mode = next;
  segButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === next);
  });
  atTimePanel.classList.toggle('hidden', next !== 'atTime');
  repeatPanel.classList.toggle('hidden', next !== 'repeat');
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

function friendlyStatus(state) {
  if (!state?.isActive) return 'No reminder set';
  if (state.mode === 'repeat') {
    const label = {
      15: 'every 15 min',
      30: 'every 30 min',
      45: 'every 45 min',
      60: 'every hour',
    }[state.intervalMinutes] || `every ${state.intervalMinutes} min`;
    return `Saved · repeats ${label}`;
  }
  return `Saved · drops at ${formatTime(state.alarmTime)}`;
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
  const original = 'Set Reminder';
  setBtn.textContent = 'Saved ✓';
  setBtn.classList.add('saved');
  clearTimeout(buttonTimer);
  buttonTimer = setTimeout(() => {
    setBtn.textContent = original;
    setBtn.classList.remove('saved');
  }, 1800);
}

function renderState(state, { celebrate = false } = {}) {
  if (!state) return;
  messageEl.value = state.reminderText || '';
  alarmTimeEl.value = state.alarmTime || '08:00';
  intervalEl.value = String(state.intervalMinutes || 60);
  setMode(state.mode === 'repeat' ? 'repeat' : 'atTime');
  activeToggle.checked = Boolean(state.isActive);
  toggleLabel.textContent = state.isActive ? 'On' : 'Off';

  statusEl.textContent = friendlyStatus(state);
  statusEl.classList.toggle('active', Boolean(state.isActive));

  if (celebrate && state.isActive) {
    statusEl.classList.remove('flash');
    // reflow so animation can replay
    void statusEl.offsetWidth;
    statusEl.classList.add('flash');
    showToast(friendlyStatus(state));
    flashSavedButton();
  }
}

segButtons.forEach((btn) => {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

setBtn.addEventListener('click', async () => {
  setBtn.disabled = true;
  try {
    const state = await window.spydy.setReminder(collectPartial());
    renderState(state, { celebrate: true });
  } finally {
    setBtn.disabled = false;
  }
});

$('clearBtn').addEventListener('click', async () => {
  const state = await window.spydy.clearReminder();
  renderState(state);
  showToast('Reminder cleared');
});

$('testBtn').addEventListener('click', async () => {
  await window.spydy.setState(collectPartial());
  await window.spydy.testReminder();
});

activeToggle.addEventListener('change', async () => {
  const state = await window.spydy.toggleActive(activeToggle.checked);
  renderState(state, { celebrate: Boolean(state.isActive) });
});

window.spydy.onState((state) => renderState(state));
window.spydy.getState().then((state) => renderState(state));
