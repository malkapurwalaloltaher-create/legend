const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "../data/auto-message-config.json");
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

let _client = null;
const activeIntervals = {};

function ensureJsonFile(filePath, defaultValue) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
}

function getConfig() {
  ensureJsonFile(CONFIG_PATH, {});
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  ensureJsonFile(CONFIG_PATH, {});
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getSettings(guildId) {
  const config = getConfig();
  return config[guildId] || null;
}

async function sendAutoMessage(guildId) {
  const config = getConfig();
  const settings = config[guildId];
  if (!settings || !settings.active || !settings.channelId || !settings.message) return;

  const channel = await _client.channels.fetch(settings.channelId).catch(() => null);
  if (!channel) return;

  await channel.send(settings.message);
}

function stopLoop(guildId) {
  if (activeIntervals[guildId]) {
    clearInterval(activeIntervals[guildId]);
    delete activeIntervals[guildId];
  }
}

function startLoop(guildId) {
  stopLoop(guildId);

  const settings = getSettings(guildId);
  if (!settings || !settings.active || !settings.channelId || !settings.message) return;

  activeIntervals[guildId] = setInterval(async () => {
    try {
      await sendAutoMessage(guildId);
    } catch (err) {
      console.error("[AutoMessage loop]", err.message);
    }
  }, TWELVE_HOURS_MS);
}

function setAutoMessage(guildId, channelId, message) {
  const config = getConfig();

  config[guildId] = {
    channelId,
    message,
    active: true,
    intervalMs: TWELVE_HOURS_MS,
  };

  saveConfig(config);
  startLoop(guildId);
}

function stopAutoMessage(guildId) {
  const config = getConfig();

  if (config[guildId]) {
    config[guildId].active = false;
    saveConfig(config);
  }

  stopLoop(guildId);
}

async function init(client) {
  _client = client;

  const config = getConfig();
  for (const guildId of Object.keys(config)) {
    if (config[guildId]?.active) {
      startLoop(guildId);
    }
  }
}

module.exports = {
  init,
  setAutoMessage,
  stopAutoMessage,
  getSettings,
  sendAutoMessage,
};
