/**
 * Dev-only: renders the popup with a stubbed bridge and writes a PNG so the
 * layout can be inspected without waiting for a tray click.
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.commandLine.appendSwitch('force-color-profile', 'srgb');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 360,
    height: 730,
    show: false,
    frame: false,
    backgroundColor: '#0d0b0a',
    webPreferences: {
      preload: path.join(__dirname, 'stub-preload.js'),
      contextIsolation: false,
      nodeIntegration: false,
    },
  });

  win.webContents.on('console-message', (_e, _lvl, msg) => console.log('PAGE ' + msg));

  await win.loadFile(path.join(__dirname, '..', 'renderer', 'popup', 'index.html'));
  await new Promise((r) => setTimeout(r, 900));

  const shot = await win.capturePage();
  const out = path.join(__dirname, 'popup-shot.png');
  fs.writeFileSync(out, shot.toPNG());

  const metrics = await win.webContents.executeJavaScript(`
    (() => {
      const shell = document.querySelector('.shell');
      const cs = getComputedStyle(shell);
      return {
        shellScrollHeight: shell.scrollHeight,
        shellClientHeight: shell.clientHeight,
        overflows: shell.scrollHeight > shell.clientHeight + 1,
        gap: cs.gap,
        days: [...document.querySelectorAll('.day.on')].map(d => d.getAttribute('aria-label')),
        chipsActive: [...document.querySelectorAll('.chip.active')].map(c => c.textContent),
        dismissActive: [...document.querySelectorAll('#dismissSeg .seg-btn.active')].map(b => b.textContent),
        modeActive: [...document.querySelectorAll('.seg-btn[data-mode].active')].map(b => b.textContent),
        modeStyles: [...document.querySelectorAll('.seg-btn[data-mode]')].map(b => ({
          label: b.textContent,
          hasActive: b.classList.contains('active'),
          bg: getComputedStyle(b).backgroundColor,
          color: getComputedStyle(b).color,
        })),
        contrastProbe: [
          ['hint', getComputedStyle(document.getElementById('quietHint')).color],
          ['preset', getComputedStyle(document.querySelector('.link-btn.tiny')).color],
          ['label', getComputedStyle(document.querySelector('.label')).color],
        ],
        quietHidden: document.getElementById('quietPanel').classList.contains('hidden'),
        quietHint: document.getElementById('quietHint').textContent,
        status: document.getElementById('status').textContent,
        statusClass: document.getElementById('status').className,
      };
    })()
  `);
  console.log('METRICS ' + JSON.stringify(metrics, null, 2));
  console.log('SHOT ' + out);
  app.exit(0);
});
