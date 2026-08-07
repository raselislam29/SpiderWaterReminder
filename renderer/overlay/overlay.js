const stage = document.getElementById('stage');
const cardMsg = document.getElementById('cardMsg');

let showTimer = null;

function clearTimers() {
  if (showTimer != null) {
    clearTimeout(showTimer);
    showTimer = null;
  }
}

/**
 * Only asks to be dismissed. The main process owns the decision so that every
 * monitor leaves together instead of whichever screen was clicked.
 */
function requestDismiss() {
  if (!stage.classList.contains('visible')) return;
  window.swr.dismissOverlay();
}

/** Play the exit. Main broadcasts this to all screens at the same instant. */
function leave() {
  if (!stage.classList.contains('visible')) return;
  clearTimers();
  stage.classList.remove('dropping');
  stage.classList.add('leaving');
}

function startDrop(message) {
  cardMsg.textContent = message || 'Time to drink water';
  stage.classList.remove('leaving', 'dropping', 'visible');
  void stage.offsetWidth;
  stage.classList.add('visible', 'dropping');
}

function show(payload) {
  clearTimers();
  const message = payload?.message || 'Time to drink water';
  const startAt = Number(payload?.startAt) || 0;
  const delay = startAt > 0 ? Math.max(0, startAt - Date.now()) : 0;

  stage.classList.remove('leaving', 'dropping', 'visible');

  if (delay <= 0) {
    startDrop(message);
    return;
  }

  showTimer = setTimeout(() => startDrop(message), delay);
}

document.body.addEventListener('click', requestDismiss);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') requestDismiss();
});

window.swr.onOverlayShow(show);
window.swr.onOverlayLeave(leave);
