const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  screen,
  globalShortcut,
  powerMonitor,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { loadState, saveState } = require('./store');
const { ReminderScheduler } = require('./scheduler');

// Avoid Chromium GPU/disk cache fights when a second instance starts.
const userData = path.join(app.getPath('appData'), 'SpiderWaterReminder');
const cacheDir = path.join(userData, 'Cache');
fs.mkdirSync(cacheDir, { recursive: true });
app.setPath('userData', userData);
app.commandLine.appendSwitch('disk-cache-dir', cacheDir);
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let tray = null;
let popupWindow = null;
/** @type {BrowserWindow[]} */
let overlayWindows = [];
let state = null;
let scheduler = null;

const ASSETS = path.join(__dirname, '..', 'assets');

function asset(...parts) {
  return path.join(ASSETS, ...parts);
}

function destroyOverlayWindows() {
  for (const win of overlayWindows) {
    if (win && !win.isDestroyed()) win.destroy();
  }
  overlayWindows = [];
}

function createOverlayForDisplay(display) {
  const { x, y, width, height } = display.bounds;
  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'overlay', 'index.html'));
  return win;
}

function createPopupWindow() {
  popupWindow = new BrowserWindow({
    width: 340,
    height: 500,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  popupWindow.loadFile(path.join(__dirname, '..', 'renderer', 'popup', 'index.html'));
  popupWindow.on('blur', () => {
    if (popupWindow && !popupWindow.webContents.isDevToolsOpened()) {
      popupWindow.hide();
    }
  });
}

function createOverlayWindows() {
  destroyOverlayWindows();
  overlayWindows = screen.getAllDisplays().map((display) => createOverlayForDisplay(display));
}

function positionPopupNearTray() {
  if (!popupWindow || !tray) return;
  const trayBounds = tray.getBounds();
  const winBounds = popupWindow.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y,
  });
  const work = display.workArea;

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
  let y = Math.round(trayBounds.y - winBounds.height - 8);

  // Taskbar at bottom (typical Windows): open above tray
  if (trayBounds.y > work.y + work.height / 2) {
    y = Math.round(trayBounds.y - winBounds.height - 8);
  } else {
    // Taskbar top
    y = Math.round(trayBounds.y + trayBounds.height + 8);
  }

  x = Math.min(Math.max(work.x + 8, x), work.x + work.width - winBounds.width - 8);
  y = Math.min(Math.max(work.y + 8, y), work.y + work.height - winBounds.height - 8);
  popupWindow.setPosition(x, y, false);
}

function togglePopup() {
  if (!popupWindow) return;
  if (popupWindow.isVisible()) {
    popupWindow.hide();
    return;
  }
  positionPopupNearTray();
  popupWindow.show();
  popupWindow.focus();
  popupWindow.webContents.send('state:updated', state);
}

function broadcastState() {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.webContents.send('state:updated', state);
  }
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

function formatCountdown(nextFireAt) {
  if (!nextFireAt) return '';
  const sec = Math.max(0, Math.round((nextFireAt - Date.now()) / 1000));
  if (sec < 60) return `in ${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  if (min < 60) return rem ? `in ${min}m ${rem}s` : `in ${min}m`;
  const hr = Math.floor(min / 60);
  const mins = min % 60;
  return mins ? `in ${hr}h ${mins}m` : `in ${hr}h`;
}

function statusFor(activeState, nextFireAt = scheduler?.getNextFireAt?.()) {
  if (!activeState?.isActive) return 'No reminder set · keep app in tray';
  const eta = formatCountdown(nextFireAt);
  if (activeState.mode === 'repeat') {
    const label = {
      1: 'every 1 min',
      5: 'every 5 min',
      15: 'every 15 min',
      30: 'every 30 min',
      45: 'every 45 min',
      60: 'every hour',
    }[activeState.intervalMinutes] || `every ${activeState.intervalMinutes} min`;
    return eta ? `Repeats ${label} · next ${eta}` : `Repeats ${label}`;
  }
  return eta
    ? `Drops at ${formatTime(activeState.alarmTime)} · ${eta}`
    : `Drops at ${formatTime(activeState.alarmTime)}`;
}

function refreshStatus({ broadcastFull = false } = {}) {
  if (!state) return;
  state.statusText = statusFor(state, scheduler?.getNextFireAt());
  if (tray) {
    tray.setToolTip(
      state.isActive
        ? `SpiderWaterReminder — ${state.statusText}`
        : 'SpiderWaterReminder — set a reminder (must stay running)'
    );
  }
  if (broadcastFull) {
    broadcastState();
    return;
  }
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.webContents.send('status:tick', state.statusText);
  }
}

function applyState(partial, { reschedule = true } = {}) {
  state = saveState({ ...state, ...partial, statusText: undefined });
  if (reschedule) scheduler.configure(state);
  refreshStatus({ broadcastFull: true });
  state = saveState(state);
  return state;
}

function whenOverlayReady(win) {
  return new Promise((resolve) => {
    if (!win || win.isDestroyed()) {
      resolve();
      return;
    }
    if (!win.webContents.isLoading()) {
      resolve();
      return;
    }
    win.webContents.once('did-finish-load', () => resolve());
  });
}

async function showOverlay(message) {
  if (!overlayWindows.length) createOverlayWindows();
  if (popupWindow && popupWindow.isVisible()) popupWindow.hide();

  const displays = screen.getAllDisplays();

  // Keep one overlay window per monitor (rebuild if display count changed).
  if (overlayWindows.length !== displays.length) {
    createOverlayWindows();
  }

  const windows = overlayWindows.filter((win) => win && !win.isDestroyed());
  windows.forEach((win, index) => {
    const bounds = displays[index]?.bounds || displays[0].bounds;
    win.setBounds(bounds);
    win.showInactive();
  });

  // Wait until every screen overlay is ready, then start them together.
  await Promise.all(windows.map((win) => whenOverlayReady(win)));

  const payload = {
    message: message || state.reminderText,
    // Shared wall-clock start so every display begins the same frame.
    startAt: Date.now() + 80,
  };

  for (const win of windows) {
    if (!win.isDestroyed()) win.webContents.send('overlay:show', payload);
  }

  // Focus the overlay on the monitor with the cursor.
  const cursorDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const focusIndex = Math.max(
    0,
    displays.findIndex((d) => d.id === cursorDisplay.id)
  );
  const focusWin = overlayWindows[focusIndex] || overlayWindows[0];
  if (focusWin && !focusWin.isDestroyed()) focusWin.focus();

  try {
    globalShortcut.register('Escape', hideOverlay);
  } catch {
    // already registered
  }
}

function hideOverlay() {
  try {
    globalShortcut.unregister('Escape');
  } catch {
    // ignore
  }
  for (const win of overlayWindows) {
    if (win && !win.isDestroyed()) win.hide();
  }
}

function createTray() {
  const iconPath = asset('logo.png');
  let image = nativeImage.createFromPath(iconPath);
  if (!image.isEmpty()) {
    image = image.resize({ width: 16, height: 16 });
  }
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  const tip = state?.isActive
    ? `SpiderWaterReminder — ${statusFor(state)}`
    : 'SpiderWaterReminder';
  tray.setToolTip(tip);
  tray.on('click', togglePopup);
  tray.on('right-click', () => {
    const menu = Menu.buildFromTemplate([
      { label: 'Open SpiderWaterReminder', click: togglePopup },
      { label: 'Test Drop', click: () => showOverlay(state.reminderText) },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]);
    tray.popUpContextMenu(menu);
  });
}

function registerIpc() {
  ipcMain.handle('state:get', () => state);

  ipcMain.handle('state:set', (_e, partial) => applyState(partial, { reschedule: false }));

  ipcMain.handle('reminder:set', (_e, partial) => {
    return applyState({
      ...partial,
      isActive: true,
    });
  });

  ipcMain.handle('reminder:clear', () => {
    return applyState({ isActive: false });
  });

  ipcMain.handle('reminder:toggle', (_e, isActive) => {
    return applyState({ isActive: Boolean(isActive) });
  });

  ipcMain.handle('reminder:test', () => {
    showOverlay(state.reminderText);
    return true;
  });

  ipcMain.on('overlay:dismiss', () => hideOverlay());
}

if (gotLock) {
  app.on('second-instance', () => {
    togglePopup();
  });

  app.whenReady().then(() => {
    // Keep reminders alive after reboot / login.
    app.setLoginItemSettings({ openAtLogin: true, enabled: true });

    state = loadState();
    // Clean corrupted emoji leftovers from older saves.
    if (typeof state.reminderText === 'string') {
      state.reminderText = state.reminderText.replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '').trim()
        || 'Time to drink water';
    }

    scheduler = new ReminderScheduler({
      onFire: (current) => showOverlay(current?.reminderText),
      onTick: () => refreshStatus(),
    });
    scheduler.configure(state);
    refreshStatus({ broadcastFull: true });

    createPopupWindow();
    createOverlayWindows();
    createTray();
    registerIpc();

    powerMonitor.on('resume', () => {
      if (state?.isActive) scheduler.configure(state);
    });

    screen.on('display-added', () => createOverlayWindows());
    screen.on('display-removed', () => createOverlayWindows());
    screen.on('display-metrics-changed', () => createOverlayWindows());

    app.on('activate', () => {
      if (!popupWindow) createPopupWindow();
    });
  });
}

app.on('window-all-closed', () => {
  // Stay alive in the system tray.
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  scheduler?.stop();
  destroyOverlayWindows();
});
