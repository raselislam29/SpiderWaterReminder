const stage = document.getElementById('stage');
const cardMsg = document.getElementById('cardMsg');

let showTimer = null;
let dismissTimer = null;

function clearTimers() {
  if (showTimer != null) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  if (dismissTimer != null) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
}

function dismiss() {
  if (!stage.classList.contains('visible')) return;
  clearTimers();
  stage.classList.remove('dropping');
  stage.classList.add('leaving');
  dismissTimer = setTimeout(() => {
    stage.classList.remove('visible', 'leaving');
    window.spydy.dismissOverlay();
  }, 1100);
}

function startDrop(message) {
  cardMsg.textContent = message || 'Time to drink water! 💧';
  stage.classList.remove('leaving', 'dropping', 'visible');
  // Force style flush so animation restarts from frame 0 on every screen.
  void stage.offsetWidth;
  stage.classList.add('visible', 'dropping');
}

function show(payload) {
  clearTimers();
  const message = payload?.message || 'Time to drink water! 💧';
  const startAt = Number(payload?.startAt) || 0;
  const delay = startAt > 0 ? Math.max(0, startAt - Date.now()) : 0;

  // Hide until the shared start time so late screens don't "catch up" mid-drop.
  stage.classList.remove('leaving', 'dropping', 'visible');

  if (delay <= 0) {
    startDrop(message);
    return;
  }

  showTimer = setTimeout(() => startDrop(message), delay);
}

document.body.addEventListener('click', dismiss);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') dismiss();
});

window.spydy.onOverlayShow(show);
