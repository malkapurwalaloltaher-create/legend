function parseDuration(input) {
  if (!input) throw new Error("Duration is required.");

  const regex = /(\d+)([smhd])/gi;
  let total = 0;
  let match;

  while ((match = regex.exec(String(input))) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    if (unit === "s") total += value * 1000;
    if (unit === "m") total += value * 60 * 1000;
    if (unit === "h") total += value * 60 * 60 * 1000;
    if (unit === "d") total += value * 24 * 60 * 60 * 1000;
  }

  if (total <= 0) throw new Error("Invalid duration format.");
  return total;
}

function parseClaimTime(input) {
  if (!input || input.trim() === "") return 12 * 60 * 60 * 1000; // default 12h
  if (input.trim() === "-") return -1; // forever

  const value = parseDuration(input);

  if (value < 60 * 60 * 1000) {
    throw new Error("Claim time must be at least 1h, or use - for forever.");
  }

  return value;
}

function formatDuration(ms) {
  if (ms === -1) return "No limit";
  if (!Number.isFinite(ms) || ms <= 0) return "0s";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds && parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

function formatDurationDetailed(ms) {
  if (ms === -1) return "No limit";
  if (ms <= 0) return "0 seconds";

  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  const parts = [];
  if (d) parts.push(`${d} day${d !== 1 ? "s" : ""}`);
  if (h) parts.push(`${h} hour${h !== 1 ? "s" : ""}`);
  if (m) parts.push(`${m} minute${m !== 1 ? "s" : ""}`);
  if (sec) parts.push(`${sec} second${sec !== 1 ? "s" : ""}`);

  return parts.join(", ");
}

module.exports = {
  parseDuration,
  parseClaimTime,
  formatDuration,
  formatDurationDetailed
};
