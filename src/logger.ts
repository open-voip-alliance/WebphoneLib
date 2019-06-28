export enum LoggerLevel {
  ERROR,
  WARN,
  INFO,
  VERBOSE,
  DEBUG
}

interface ILoggerConnector {
  level: LoggerLevel;
  message: string;
  context: any;
}

type LoggerConnector = (ILoggerConnector) => void;

class Logger {
  public level: LoggerLevel = LoggerLevel.INFO;
  private levels: { [index: string]: LoggerLevel } = {
    debug: LoggerLevel.DEBUG,
    error: LoggerLevel.ERROR,
    info: LoggerLevel.INFO,
    verbose: LoggerLevel.VERBOSE,
    warn: LoggerLevel.WARN
  };
  private connector?: LoggerConnector;

  constructor(level: LoggerLevel, connector?: LoggerConnector) {
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
      this.connector({ level, message, context });
    }
  }
}

export const log = new Logger(LoggerLevel.INFO);
