import eventTarget from '../utils/eventTarget.mjs';

export const loggingEvents = eventTarget();

const LEVELS = {
  error: 4,
  warn: 3,
  info: 2,
  verbose: 1,
  debug: 0
};

export let verbosity = 'info';

export class Logger {
  constructor(module) {
    this.module = module;

    // Define aliases for each log level on Logger.
    // eg. `Logger.info(...) = Logger.log('info', ...)`
    Object.keys(LEVELS).forEach(level => {
      this[level] = function() {
        this.log.call(this, level, ...arguments);
      }.bind(this);
    });
  }

  log(level, message) {
    const verbosityIdx = LEVELS[verbosity] || 0;
    const levelIdx = LEVELS[level] || 0;
    const module = this.module;
    if (levelIdx >= verbosityIdx) {
      loggingEvents.dispatchEvent(
        new CustomEvent('log_to_console', { detail: { level, message, module } })
      );
    }
  }
}
