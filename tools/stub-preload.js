/** Dev-only stub of the real preload bridge, for layout screenshots. */
const state = {
  reminderText: 'Drink Water',
  mode: 'repeat',
  alarmTime: '13:00',
  intervalMinutes: 45,
  isActive: true,
  statusText: 'Repeats every 45 min · next in 44m 12s',
  activeDays: [1, 2, 3, 4, 5],
  quietHoursEnabled: true,
  quietStart: '22:00',
  quietEnd: '07:00',
  autoDismissSeconds: 30,
};

window.swr = {
  getState: () => Promise.resolve({ ...state }),
  setState: (p) => Promise.resolve({ ...state, ...p }),
  setReminder: (p) => Promise.resolve({ ...state, ...p, isActive: true, statusText: 'Saved' }),
  clearReminder: () => Promise.resolve({ ...state, isActive: false, statusText: 'No reminder set' }),
  testReminder: () => Promise.resolve(true),
  toggleActive: (isActive) => Promise.resolve({ ...state, isActive }),
  dismissOverlay: () => {},
  reportHeight: () => {},
  onOverlayShow: () => () => {},
  onState: () => () => {},
  onStatusTick: () => () => {},
};
