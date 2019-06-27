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
  private connector?: (message: string) => void;

  constructor(level: LoggerLevel, connector?: (message: string) => void) {
    this.level = level;

    if (connector) {
      this.connector = connector;
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

  public log(level, message, context) {
    if (this.connector && this.level >= this.levels[level]) {
      this.connector(`[${context}]: ${message}`);
    }
  }
}

export const log = new Logger(LoggerLevel.INFO);
