const stage = document.getElementById('stage');
const cardMsg = document.getElementById('cardMsg');

function dismiss() {
  if (!stage.classList.contains('visible')) return;
  stage.classList.remove('dropping');
  stage.classList.add('leaving');
  setTimeout(() => {
    stage.classList.remove('visible', 'leaving');
    window.spydy.dismissOverlay();
  }, 1100);
}

function show(payload) {
  cardMsg.textContent = payload?.message || 'Time to drink water! 💧';
  stage.classList.remove('leaving');
  stage.classList.add('visible', 'dropping');
}

document.body.addEventListener('click', dismiss);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') dismiss();
});

window.spydy.onOverlayShow(show);
