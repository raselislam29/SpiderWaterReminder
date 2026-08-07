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

  #computeNextFire(state, afterMs) {
    if (state.mode === 'repeat') {
      const ms = Math.max(1, Number(state.intervalMinutes) || 60) * 60 * 1000;
      return afterMs + ms;
    }
    return this.#nextAlarmTimestamp(state.alarmTime, afterMs);
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

module.exports = { ReminderScheduler };
