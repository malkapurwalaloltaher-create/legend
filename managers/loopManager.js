const { GoogleGenAI } = require("@google/genai");
const { EmbedBuilder } = require("discord.js");

const LoopConfig = require("../models/LoopConfig");
const AiCache = require("../models/AiCache");
const DashboardLoopContent = require("../models/DashboardLoopContent");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const API_COOLDOWN_MS = 60 * 60 * 1000;

const activeIntervals = {};
let _client = null;

let ai = null;
function getAiClient() {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!ai) ai = new GoogleGenAI({ apiKey });
  return ai;
}

const fallbackYaps = [
  "Some people wake up motivated. I wake up like my brain is still buffering on airport WiFi.",
  "Life is just doing side quests until the main mission randomly updates without warning.",
  "If overthinking was a sport, I’d have trophies, sponsors, and a Netflix documentary.",
  "My attention span left the chat, joined another server, and became admin there.",
  "The way people say 'quick question' before dropping a whole boss fight should be illegal.",
  "I don’t procrastinate. I just give deadlines a dramatic final episode.",
  "Some days I feel productive. Then I open one app and suddenly it’s tomorrow.",
  "Food tastes better when you were not supposed to eat it at 2 AM.",
  "My brain has 47 tabs open and none of them are playing the right audio.",
  "Confidence is just pretending you know what’s happening until reality gives up.",
  "I respect people with routines because my schedule is vibes, panic, and accidental naps.",
  "If being confused was a personality, I’d be verified.",
  "The fridge light has seen more late-night decisions than any therapist.",
  "I don’t need drama. My WiFi disconnecting for 3 seconds is enough emotional damage.",
  "Sleep is just a free trial of not having responsibilities.",
  "Some people touch grass. I negotiate with my charger angle like it’s ancient technology.",
  "The human brain is powerful, yet mine forgets why I entered a room every 12 minutes.",
  "I’m not lazy. I’m just in battery saver mode with no charger nearby.",
  "Every group chat has one person who replies after 8 business days like nothing happened.",
  "Sometimes the biggest plot twist is realizing the problem was me all along.",
  "Reality is weird because we all agreed money is real and Mondays are legal.",
  "My productivity has DLC locked behind motivation I never purchased.",
  "Being online too much makes normal silence feel like a loading screen.",
  "I trust people who say 'bro listen' because something legendary or illegal is about to be explained.",
];

const fallbackRumors = [
  "🚨 BREAKING: A footballer allegedly blamed lag after missing an open goal in real life. Source: emotional teammates.",
  "👀 Rumor says a celebrity muted their own group chat and called it mental health leadership. Source: dramatic screenshots.",
  "🔥 Reports claim a gamer touched grass and immediately asked where the settings menu was. Source: concerned villagers.",
  "😱 A tech CEO allegedly forgot their password and called it a security experiment. Source: trust me bro.",
  "🚨 BREAKING: Someone said 'one last match' and was seen 6 hours later questioning life choices. Source: tired keyboard.",
  "👑 Rumor has it a Discord admin touched permissions once and accidentally created a government. Source: server staff.",
  "📱 Viral rumor: an influencer cried because their iced coffee had too much ice. Source: emotional beverage reports.",
  "⚽ Reports say a striker missed so badly the ball asked for a transfer. Source: stadium WiFi.",
  "🏏 Rumor says a cricket player blamed the pitch, weather, moon phase, and vibes after getting bowled. Source: dressing room whispers.",
  "🚨 BREAKING: A student said 'I’ll study in 5 minutes' and historians are still waiting. Source: ancient notes.",
  "👀 Sources say someone opened Discord for one notification and accidentally lost 3 hours. Source: screen time report.",
  "🔥 Rumor says a server owner added one bot and somehow ended up with 49 bots and 130 roles. Source: chaos department.",
];

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function shuffleArray(array) {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function randomPick(array) {
  if (!array.length) return null;
  return array[Math.floor(Math.random() * array.length)];
}

function isQuotaOrBusyError(err) {
  const msg = err?.message || String(err);

  return (
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("high demand")
  );
}

async function getOrCreateTodayCache() {
  const dateKey = getTodayKey();

  let cache = await AiCache.findOne({ dateKey });

  if (!cache) {
    cache = await AiCache.create({
      dateKey,
      yaps: [],
      rumors: [],
      usedYaps: [],
      usedRumors: [],
      apiBlockedUntil: 0,
    });
  }

  return cache;
}

async function ensureGuildDoc(guildId) {
  let doc = await LoopConfig.findOne({ guildId });

  if (!doc) {
    doc = await LoopConfig.create({
      guildId,
      yap: {
        channelId: null,
        intervalMs: 1800000,
        active: false,
        lastSentAt: null,
        lastSource: "none",
        lastMessage: "",
      },
      rumors: {
        channelId: null,
        intervalMs: 3600000,
        active: false,
        lastSentAt: null,
        lastSource: "none",
        lastMessage: "",
      },
    });
  }

  if (!doc.yap) {
    doc.yap = {
      channelId: null,
      intervalMs: 1800000,
      active: false,
      lastSentAt: null,
      lastSource: "none",
      lastMessage: "",
    };
  }

  if (!doc.rumors) {
    doc.rumors = {
      channelId: null,
      intervalMs: 3600000,
      active: false,
      lastSentAt: null,
      lastSource: "none",
      lastMessage: "",
    };
  }

  if (doc.yap.lastSource === undefined) doc.yap.lastSource = "none";
  if (doc.yap.lastMessage === undefined) doc.yap.lastMessage = "";
  if (doc.yap.lastSentAt === undefined) doc.yap.lastSentAt = null;

  if (doc.rumors.lastSource === undefined) doc.rumors.lastSource = "none";
  if (doc.rumors.lastMessage === undefined) doc.rumors.lastMessage = "";
  if (doc.rumors.lastSentAt === undefined) doc.rumors.lastSentAt = null;

  await doc.save();

  return doc;
}

async function calculateDailyNeeds() {
  const configs = await LoopConfig.find({
    $or: [{ "yap.active": true }, { "rumors.active": true }],
  });

  let yapCount = 24;
  let rumorCount = 12;

  for (const cfg of configs) {
    if (cfg.yap?.active && cfg.yap?.intervalMs) {
      yapCount = Math.max(yapCount, Math.ceil(ONE_DAY_MS / Number(cfg.yap.intervalMs)));
    }

    if (cfg.rumors?.active && cfg.rumors?.intervalMs) {
      rumorCount = Math.max(rumorCount, Math.ceil(ONE_DAY_MS / Number(cfg.rumors.intervalMs)));
    }
  }

  return { yapCount, rumorCount };
}

async function generateDailyYaps(count) {
  const response = await getAiClient()?.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `
Generate exactly ${count} separate Discord yap messages.

Rules:
- one message per line only
- no numbering
- no intro
- 25 to 35 words each
- funny, chaotic, deep, brainrot, shower-thought, terminally-online styles mixed
- very varied
- no repeated structure
`,
    config: { maxOutputTokens: 8192 },
  });

  return (response.text || "")
    .split("\n")
    .map((x) => x.trim().replace(/^[-*\d.]+\s*/, ""))
    .filter(Boolean)
    .slice(0, count);
}

async function generateDailyRumors(count) {
  const response = await getAiClient()?.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `
Generate exactly ${count} fake viral Discord rumor posts.

Rules:
- one rumor per line only
- no numbering
- under 260 characters each
- social media drama style
- fake and funny, not real news
- output only the rumor text
- do not include GIF keywords, URLs, image instructions, or extra metadata
`,
    config: { maxOutputTokens: 8192 },
  });

  return (response.text || "")
    .split("\n")
    .map((x) => x.trim().replace(/^[-*\d.]+\s*/, ""))
    .filter(Boolean)
    .slice(0, count)
    .map((line) => line.split("||")[0]?.trim())
    .filter(Boolean);
}

async function getDashboardFallbackYaps(guildId) {
  const items = await DashboardLoopContent.find({
    guildId,
    type: "yap",
    sourceType: "fallback",
    enabled: true,
  });

  return items.map((item) => item.text).filter(Boolean);
}

async function getDashboardFallbackRumors(guildId) {
  const items = await DashboardLoopContent.find({
    guildId,
    type: "rumor",
    sourceType: "fallback",
    enabled: true,
  });

  return items.map((item) => item.text).filter(Boolean);
}

async function getDashboardCustomYap(guildId) {
  const items = await DashboardLoopContent.find({
    guildId,
    type: "yap",
    sourceType: "custom",
    enabled: true,
  });

  const picked = randomPick(items);
  if (!picked) return null;

  return {
    text: picked.text,
    source: "dashboard-custom",
  };
}

async function getDashboardCustomRumor(guildId) {
  const items = await DashboardLoopContent.find({
    guildId,
    type: "rumor",
    sourceType: "custom",
    enabled: true,
  });

  const picked = randomPick(items);
  if (!picked) return null;

  return {
    text: picked.text,
    source: "dashboard-custom",
  };
}

async function ensureDailyCache(guildId = null) {
  const cache = await getOrCreateTodayCache();
  const { yapCount, rumorCount } = await calculateDailyNeeds();

  const apiBlocked = cache.apiBlockedUntil && Date.now() < cache.apiBlockedUntil;

  const dashboardFallbackYaps = guildId ? await getDashboardFallbackYaps(guildId) : [];
  const dashboardFallbackRumors = guildId ? await getDashboardFallbackRumors(guildId) : [];

  const allFallbackYaps = [...dashboardFallbackYaps, ...fallbackYaps];
  const allFallbackRumors = [...dashboardFallbackRumors, ...fallbackRumors];

  if (!apiBlocked && cache.yaps.length + cache.usedYaps.length < yapCount) {
    try {

      cache.yaps = shuffleArray(await generateDailyYaps(yapCount));
      cache.usedYaps = [];

      await cache.save();
    } catch (err) {
      console.error("[CACHE] Yap generation error:", err.message || String(err));

      if (isQuotaOrBusyError(err)) {
        cache.apiBlockedUntil = Date.now() + API_COOLDOWN_MS;
      }

      cache.yaps = shuffleArray(allFallbackYaps);
      cache.usedYaps = [];

      await cache.save();
    }
  }

  if (!apiBlocked && cache.rumors.length + cache.usedRumors.length < rumorCount) {
    try {

      cache.rumors = shuffleArray(await generateDailyRumors(rumorCount));
      cache.usedRumors = [];

      await cache.save();
    } catch (err) {
      console.error("[CACHE] Rumor generation error:", err.message || String(err));

      if (isQuotaOrBusyError(err)) {
        cache.apiBlockedUntil = Date.now() + API_COOLDOWN_MS;
      }

      cache.rumors = shuffleArray(allFallbackRumors);
      cache.usedRumors = [];

      await cache.save();
    }
  }

  if (!cache.yaps.length) {
    cache.yaps = shuffleArray(allFallbackYaps);
  }

  if (!cache.rumors.length) {
    cache.rumors = shuffleArray(allFallbackRumors);
  }

  await cache.save();
}

async function takeNextYap(guildId) {
  const custom = await getDashboardCustomYap(guildId);

  if (custom) {
    return custom;
  }

  await ensureDailyCache(guildId);

  const cache = await getOrCreateTodayCache();
  const dashboardFallbackYaps = await getDashboardFallbackYaps(guildId);
  const allFallbackYaps = [...dashboardFallbackYaps, ...fallbackYaps];

  if (!cache.yaps.length) {
    cache.yaps = shuffleArray(allFallbackYaps.filter((x) => !cache.usedYaps.includes(x)));

    if (!cache.yaps.length) {
      cache.usedYaps = [];
      cache.yaps = shuffleArray(allFallbackYaps);
    }
  }

  const yap = cache.yaps.shift();
  cache.usedYaps.push(yap);

  await cache.save();

  const isFallback = allFallbackYaps.includes(yap);

  return {
    text: yap,
    source: isFallback ? "fallback" : "ai",
  };
}

async function takeNextRumor(guildId) {
  const custom = await getDashboardCustomRumor(guildId);

  if (custom) {
    return custom;
  }

  await ensureDailyCache(guildId);

  const cache = await getOrCreateTodayCache();
  const dashboardFallbackRumors = await getDashboardFallbackRumors(guildId);
  const allFallbackRumors = [...dashboardFallbackRumors, ...fallbackRumors];

  if (!cache.rumors.length) {
    const usedSet = new Set(cache.usedRumors);

    cache.rumors = shuffleArray(allFallbackRumors.filter((x) => !usedSet.has(x.text)));

    if (!cache.rumors.length) {
      cache.usedRumors = [];
      cache.rumors = shuffleArray(allFallbackRumors);
    }
  }

  const rumor = cache.rumors.shift();
  const rumorText = typeof rumor === "string" ? rumor : rumor?.text;

  if (!rumorText) {
    return {
      text: "🚨 BREAKING: Nothing happened but everyone reacted anyway. Source: vibes.",
      source: "fallback",
    };
  }

  cache.usedRumors.push(rumorText);
  await cache.save();

  const isFallback = allFallbackRumors.includes(rumorText);

  return {
    text: rumorText,
    source: isFallback ? "fallback" : "ai",
  };
}

async function updateLastLoopInfo(guildId, type, source, message) {
  const cfg = await ensureGuildDoc(guildId);

  if (!cfg[type]) return;

  cfg[type].lastSentAt = new Date();
  cfg[type].lastSource = source || "unknown";
  cfg[type].lastMessage = message || "";

  await cfg.save();
}

async function runYap(channelId, guildId = null) {
  try {

    const channel = await _client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const finalGuildId = guildId || channel.guildId;
    const yap = await takeNextYap(finalGuildId);

    await channel.send(`🗣️ ${yap.text}`);

    await updateLastLoopInfo(finalGuildId, "yap", yap.source, yap.text);
  } catch (err) {
    console.error("[Yap loop]", err.message || String(err));
  }
}

async function runRumors(channelId, guildId = null) {
  try {

    const channel = await _client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const finalGuildId = guildId || channel.guildId;
    const item = await takeNextRumor(finalGuildId);
    const embed = new EmbedBuilder()
      .setColor(0xff6b35)
      .setDescription(item.text)
      .setFooter({ text: "📱 Trending..." })
      .setTimestamp();


    await channel.send({ embeds: [embed] });

    await updateLastLoopInfo(finalGuildId, "rumors", item.source, item.text);
  } catch (err) {
    console.error("[Rumors loop]", err.message || String(err));
  }
}

function stopLoop(guildId, type) {
  if (activeIntervals[guildId]?.[type]) {
    clearInterval(activeIntervals[guildId][type]);
    delete activeIntervals[guildId][type];
  }
}

function startLoop(guildId, type, channelId, intervalMs) {
  stopLoop(guildId, type);

  if (!activeIntervals[guildId]) {
    activeIntervals[guildId] = {};
  }

  const runners = {
    yap: runYap,
    rumors: runRumors,
  };

  const runner = runners[type];

  if (!runner) return;


  runner(channelId, guildId).catch((err) => {
    console.error(`[${type} immediate run]`, err.message);
  });

  activeIntervals[guildId][type] = setInterval(() => {
    runner(channelId, guildId).catch((err) => {
      console.error(`[${type} interval run]`, err.message);
    });
  }, Number(intervalMs));
}

async function setLoop(guildId, type, channelId, intervalMs) {
  const cfg = await ensureGuildDoc(guildId);

  const oldData = cfg[type] || {};

  cfg[type] = {
    channelId,
    intervalMs: Number(intervalMs),
    active: true,
    lastSentAt: oldData.lastSentAt || null,
    lastSource: oldData.lastSource || "none",
    lastMessage: oldData.lastMessage || "",
  };

  await cfg.save();

  await ensureDailyCache(guildId);

  startLoop(guildId, type, channelId, Number(intervalMs));
}

async function clearLoop(guildId, type) {
  const cfg = await ensureGuildDoc(guildId);

  if (!cfg[type]) {
    cfg[type] = {
      channelId: null,
      intervalMs: type === "yap" ? 1800000 : 3600000,
      active: false,
      lastSentAt: null,
      lastSource: "none",
      lastMessage: "",
    };
  }

  cfg[type].active = false;

  await cfg.save();

  stopLoop(guildId, type);
}

async function getStatus(guildId, type) {
  const cfg = await ensureGuildDoc(guildId);
  return cfg[type] || null;
}

async function runOnce(guildId, type) {
  const cfg = await ensureGuildDoc(guildId);

  if (type === "yap") {
    if (!cfg.yap?.channelId) {
      throw new Error("Yap channel is not set.");
    }

    await runYap(cfg.yap.channelId, guildId);
    return;
  }

  if (type === "rumors") {
    if (!cfg.rumors?.channelId) {
      throw new Error("Rumor channel is not set.");
    }

    await runRumors(cfg.rumors.channelId, guildId);
    return;
  }

  throw new Error("Invalid loop type.");
}

async function restoreLoops() {
  const configs = await LoopConfig.find({
    $or: [{ "yap.active": true }, { "rumors.active": true }],
  });

  for (const cfg of configs) {
    if (cfg.yap?.active && cfg.yap?.channelId) {

      startLoop(cfg.guildId, "yap", cfg.yap.channelId, Number(cfg.yap.intervalMs));
    }

    if (cfg.rumors?.active && cfg.rumors?.channelId) {

      startLoop(cfg.guildId, "rumors", cfg.rumors.channelId, Number(cfg.rumors.intervalMs));
    }
  }
}

async function init(discordClient) {
  _client = discordClient;

  await ensureDailyCache();
  await restoreLoops();
}

module.exports = {
  init,
  setLoop,
  clearLoop,
  getStatus,
  runOnce,
};
