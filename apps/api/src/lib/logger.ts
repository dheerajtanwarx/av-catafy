import { pino, type Logger, type LoggerOptions } from "pino";

export function createLogger(level: LoggerOptions["level"], pretty: boolean): Logger {
  return pino({
    level,
    redact: [
      "req.headers.cookie",
      "req.headers.authorization",
      'req.headers["x-catafy-proxy-secret"]',
      'res.headers["set-cookie"]',
    ],
    ...(pretty ? { transport: { target: "pino-pretty", options: { colorize: true } } } : {}),
  });
}
