/** Dev-only sanity checks for the day / quiet-hour rules. Run: node tools/check-scheduler.js */
const assert = require('assert');
const { ReminderScheduler } = require('../electron/scheduler');

// The next-fire maths is private, so drive it through configure() the way the
// app does, with the clock frozen at a known instant.
function nextFire(state, fromMs) {
  const sched = new ReminderScheduler({ onFire: () => {}, onTick: () => {} });
  sched.state = state;
  const realNow = Date.now;
  Date.now = () => fromMs;
  try {
    sched.configure(state);
    return sched.getNextFireAt();
  } finally {
    Date.now = realNow;
    sched.stop();
  }
}

const base = {
  reminderText: 'Drink Water',
  isActive: true,
  intervalMinutes: 60,
  activeDays: [0, 1, 2, 3, 4, 5, 6],
  quietHoursEnabled: false,
  quietStart: '22:00',
  quietEnd: '07:00',
  autoDismissSeconds: 20,
};

const d = (str) => new Date(str).getTime();
const show = (ms) => (ms == null ? 'never' : new Date(ms).toString().slice(0, 24));

// Weekdays only: a Saturday 10:00 alarm must jump to Monday.
{
  const state = { ...base, mode: 'atTime', alarmTime: '10:00', activeDays: [1, 2, 3, 4, 5] };
  const got = nextFire(state, d('2026-08-08T09:00:00')); // Saturday
  assert.strictEqual(new Date(got).getDay(), 1, 'expected Monday');
  assert.strictEqual(new Date(got).getHours(), 10);
  console.log('weekdays-only alarm      ->', show(got));
}

// Quiet hours wrapping midnight must push a 23:00 alarm out of the window.
{
  const state = { ...base, mode: 'atTime', alarmTime: '23:00', quietHoursEnabled: true };
  const got = nextFire(state, d('2026-08-10T12:00:00'));
  assert.strictEqual(got, null, 'a 23:00 alarm inside 22:00-07:00 quiet can never fire');
  console.log('alarm buried in quiet    -> never (popup warns)');
}

// Repeat mode must skip forward past the quiet window, not step through it.
{
  const state = { ...base, mode: 'repeat', intervalMinutes: 60, quietHoursEnabled: true };
  const got = nextFire(state, d('2026-08-10T22:30:00'));
  const out = new Date(got);
  assert.ok(out.getHours() >= 7 && out.getHours() < 22, `landed inside quiet: ${show(got)}`);
  console.log('repeat inside quiet      ->', show(got));
}

// Plain repeat with everything open: exactly one interval later.
{
  const state = { ...base, mode: 'repeat', intervalMinutes: 45 };
  const from = d('2026-08-10T09:00:00');
  const got = nextFire(state, from);
  assert.strictEqual(got - from, 45 * 60 * 1000);
  console.log('repeat, no restrictions  ->', show(got));
}

// A single active day still resolves rather than spinning.
{
  const state = { ...base, mode: 'atTime', alarmTime: '08:00', activeDays: [3] };
  const got = nextFire(state, d('2026-08-10T09:00:00')); // Monday
  assert.strictEqual(new Date(got).getDay(), 3, 'expected Wednesday');
  console.log('single day (Wed) alarm   ->', show(got));
}

console.log('\nall scheduler checks passed');
