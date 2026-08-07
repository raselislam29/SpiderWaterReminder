/**
 * Polling alarm clock — more reliable than a single long setTimeout
 * for tray apps that sit idle in the background.
 */
class ReminderScheduler {
  constructor({ onFire, onTick }) {
    this.onFire = onFire;
    this.onTick = onTick;
    this.state = null;
    this.nextFireAt = null;
    this.pollTimer = null;
    this.firing = false;
  }

  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.nextFireAt = null;
    this.firing = false;
  }

  configure(state) {
    this.state = state ? { ...state } : null;
    this.stop();

    if (!state?.isActive) {
      this.onTick?.(null);
      return;
    }

    this.nextFireAt = this.#computeNextFire(state, Date.now());
    this.pollTimer = setInterval(() => this.#tick(), 2000);
    this.#tick();
  }

  getNextFireAt() {
    return this.nextFireAt;
  }

  #tick() {
    if (!this.state?.isActive || this.nextFireAt == null || this.firing) {
      this.onTick?.(this.nextFireAt);
      return;
    }

    const now = Date.now();
    this.onTick?.(this.nextFireAt);

    if (now < this.nextFireAt) return;

    this.firing = true;
    try {
      this.onFire?.(this.state);
    } finally {
      // Schedule the following occurrence from the planned time to limit drift.
      const base = Math.max(this.nextFireAt, now);
      this.nextFireAt = this.#computeNextFire(this.state, base + 1);
      this.firing = false;
      this.onTick?.(this.nextFireAt);
    }
  }

  /**
   * Walks forward from the naive next occurrence until it lands on an active
   * weekday outside quiet hours. Returns null when no slot exists inside the
   * search horizon (for example quiet hours covering the only alarm time), so
   * callers can say so instead of firing at the wrong moment.
   */
  #computeNextFire(state, afterMs) {
    const isRepeat = state.mode === 'repeat';
    const stepMs = Math.max(1, Number(state.intervalMinutes) || 60) * 60 * 1000;

    let candidate = isRepeat
      ? afterMs + stepMs
      : this.#nextAlarmTimestamp(state.alarmTime, afterMs);

    // Horizon: a year of daily alarms, or a year of interval steps, whichever
    // applies. Bounded so a contradictory config can never spin.
    const maxSteps = isRepeat ? 4000 : 400;

    for (let i = 0; i < maxSteps; i++) {
      if (this.#isAllowed(state, candidate)) return candidate;

      if (isRepeat) {
        // Jump straight past the blocking window rather than stepping through
        // it one interval at a time.
        const skipTo = this.#endOfBlock(state, candidate);
        candidate = Math.max(candidate + stepMs, skipTo);
      } else {
        candidate = this.#nextAlarmTimestamp(state.alarmTime, candidate);
      }
    }
    return null;
  }

  #isAllowed(state, ms) {
    const date = new Date(ms);
    const days = Array.isArray(state.activeDays) && state.activeDays.length
      ? state.activeDays
      : [0, 1, 2, 3, 4, 5, 6];
    if (!days.includes(date.getDay())) return false;
    return !this.#isQuiet(state, date);
  }

  #isQuiet(state, date) {
    if (!state.quietHoursEnabled) return false;
    const start = toMinutes(state.quietStart, 22 * 60);
    const end = toMinutes(state.quietEnd, 7 * 60);
    if (start === end) return false; // zero-length window silences nothing
    const now = date.getHours() * 60 + date.getMinutes();
    // A window like 22:00 -> 07:00 wraps past midnight.
    return start < end ? now >= start && now < end : now >= start || now < end;
  }

  /** Earliest time the current blocking condition could have lifted. */
  #endOfBlock(state, ms) {
    const date = new Date(ms);

    if (this.#isQuiet(state, date)) {
      const end = toMinutes(state.quietEnd, 7 * 60);
      const out = new Date(date);
      out.setSeconds(0, 0);
      out.setHours(Math.floor(end / 60), end % 60, 0, 0);
      if (out.getTime() <= ms) out.setDate(out.getDate() + 1);
      return out.getTime();
    }

    // Blocked by weekday: resume at the start of the next day.
    const nextDay = new Date(date);
    nextDay.setHours(0, 0, 0, 0);
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay.getTime();
  }

  #nextAlarmTimestamp(hhmm, afterMs) {
    const [h, m] = String(hhmm || '08:00').split(':').map((n) => parseInt(n, 10));
    const after = new Date(afterMs);
    const next = new Date(after);
    next.setSeconds(0, 0);
    next.setHours(Number.isFinite(h) ? h : 8, Number.isFinite(m) ? m : 0, 0, 0);
    if (next.getTime() <= afterMs) {
      next.setDate(next.getDate() + 1);
    }
    return next.getTime();
  }
}

function toMinutes(hhmm, fallback) {
  const [h, m] = String(hhmm || '').split(':').map((n) => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return fallback;
  return h * 60 + m;
}

module.exports = { ReminderScheduler };
