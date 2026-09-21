import { config } from "./config.js";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const current = LEVELS[config.logLevel] ?? LEVELS.info;

function emit(level, msg, extra) {
  if (LEVELS[level] < current) return;
  const line = { t: new Date().toISOString(), level, msg, ...(extra || {}) };
  const out = level === "error" || level === "warn" ? console.error : console.log;
  out(JSON.stringify(line));
}

export const log = {
  debug: (msg, extra) => emit("debug", msg, extra),
  info: (msg, extra) => emit("info", msg, extra),
  warn: (msg, extra) => emit("warn", msg, extra),
  error: (msg, extra) => emit("error", msg, extra),
};
