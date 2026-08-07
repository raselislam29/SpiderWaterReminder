class ReminderScheduler {
  constructor({ onFire }) {
    this.onFire = onFire;
    this.timer = null;
    this.state = null;
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  configure(state) {
    this.state = state;
    this.stop();

    if (!state?.isActive) return;

    if (state.mode === 'repeat') {
      const ms = Math.max(1, Number(state.intervalMinutes) || 60) * 60 * 1000;
      this.timer = setTimeout(() => this.#fireAndReschedule(), ms);
      return;
    }

    const delay = this.#msUntilAlarm(state.alarmTime);
    this.timer = setTimeout(() => this.#fireAndReschedule(), delay);
  }

  #fireAndReschedule() {
    this.onFire?.(this.state);
    if (!this.state?.isActive) return;

    if (this.state.mode === 'repeat') {
      const ms = Math.max(1, Number(this.state.intervalMinutes) || 60) * 60 * 1000;
      this.timer = setTimeout(() => this.#fireAndReschedule(), ms);
      return;
    }

    // One-shot "At Time" — fire once per day at that clock time
    const delay = this.#msUntilAlarm(this.state.alarmTime);
    this.timer = setTimeout(() => this.#fireAndReschedule(), delay);
  }

  #msUntilAlarm(hhmm) {
    const [h, m] = String(hhmm || '08:00').split(':').map((n) => parseInt(n, 10));
    const now = new Date();
    const next = new Date(now);
    next.setHours(h || 0, m || 0, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return Math.max(1000, next.getTime() - now.getTime());
  }
}

module.exports = { ReminderScheduler };
