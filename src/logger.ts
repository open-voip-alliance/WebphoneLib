enum LoggerLevel {
  ERROR,
  WARN,
  INFO,
  VERBOSE,
  DEBUG
}

class Logger {
  public level: LoggerLevel = LoggerLevel.INFO;
  private levels: { [index: string]: LoggerLevel } = {
    debug: LoggerLevel.DEBUG,
    error: LoggerLevel.ERROR,
    info: LoggerLevel.INFO,
    verbose: LoggerLevel.VERBOSE,
    warn: LoggerLevel.WARN
  };

  constructor({ level }: { level: LoggerLevel }) {
    if (level) {
      this.level = level;
    }
  }

  public error(message, context) {
    this.log('error', message, context);
  }

  public warn(message, context) {
    this.log('warn', message, context);
  }

  public info(message, context) {
    this.log('info', message, context);
  }

  public debug(message, context) {
    this.log('debug', message, context);
  }

  public verbose(message, context) {
    this.log('verbose', message, context);
  }

  /**
   * Connector used to relay sipjs messages.
   */
  public connector(level, category, label, content) {
    this.debug(content, category);
  }

  private log(level, message, context) {
    if (this.level >= this.levels[level]) {
      console[level](`[${context}]: ${message}`);
    }
  }
}

export const log = new Logger({ level: LoggerLevel.INFO });
