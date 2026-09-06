const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const DashboardSportsConfig = require("../models/DashboardSportsConfig");

const CONFIG_PATH = path.join(__dirname, "../data/sports-config.json");

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

function ensureGuildConfig(guildId) {
  const config = getConfig();

  if (!config[guildId]) {
    config[guildId] = {
      football: {
        channelId: null,
        auto: false,
        intervalMs: 300000,
        locked: false,
        lastHash: "",
        scoreboardMessageId: null,
        lastGoalHash: "[]",
      },
      cricket: {
        channelId: null,
        auto: false,
        intervalMs: 300000,
        locked: false,
        lastHash: "",
        scoreboardMessageId: null,
      },
    };
    saveConfig(config);
  }

  if (!config[guildId].football) {
    config[guildId].football = {
      channelId: null,
      auto: false,
      intervalMs: 300000,
      locked: false,
      lastHash: "",
      scoreboardMessageId: null,
      lastGoalHash: "[]",
    };
  }

  if (!config[guildId].cricket) {
    config[guildId].cricket = {
      channelId: null,
      auto: false,
      intervalMs: 300000,
      locked: false,
      lastHash: "",
      scoreboardMessageId: null,
    };
  }

  saveConfig(config);
  return config;
}

function getSettings(guildId, sport) {
  const config = ensureGuildConfig(guildId);
  return config[guildId][sport];
}

async function getEffectiveSettings(guildId, sport) {
  const localSettings = getSettings(guildId, sport);

  if (localSettings?.channelId) {
    return localSettings;
  }

  const dbConfig =
    typeof DashboardSportsConfig.findOneWithMainFallback === "function"
      ? await DashboardSportsConfig.findOneWithMainFallback({ guildId }).catch(() => null)
      : await DashboardSportsConfig.findOne({ guildId }).catch(() => null);

  if (!dbConfig) {
    return localSettings;
  }

  const channelId =
    sport === "football"
      ? dbConfig.footballChannelId
      : dbConfig.cricketChannelId;

  const enabled =
    sport === "football"
      ? dbConfig.footballEnabled
      : dbConfig.cricketEnabled;

  if (channelId) {
    const config = ensureGuildConfig(guildId);

    config[guildId][sport].channelId = channelId;
    config[guildId][sport].auto = Boolean(enabled);
    config[guildId][sport].locked = true;
    config[guildId][sport].intervalMs = Math.max(60_000, Number(dbConfig.updateMinutes || 5) * 60_000);

    saveConfig(config);
    return config[guildId][sport];
  }

  return localSettings;
}


function setChannel(guildId, sport, channelId) {
  const config = ensureGuildConfig(guildId);
  config[guildId][sport].channelId = channelId;
  saveConfig(config);
}

function setAuto(guildId, sport, enabled) {
  const config = ensureGuildConfig(guildId);
  config[guildId][sport].auto = enabled;
  saveConfig(config);
}

function setLocked(guildId, sport, locked) {
  const config = ensureGuildConfig(guildId);
  config[guildId][sport].locked = locked;
  saveConfig(config);
}

function setScoreboardMessageId(guildId, sport, messageId) {
  const config = ensureGuildConfig(guildId);
  config[guildId][sport].scoreboardMessageId = messageId;
  saveConfig(config);
}

function setLastHash(guildId, sport, hash) {
  const config = ensureGuildConfig(guildId);
  config[guildId][sport].lastHash = hash;
  saveConfig(config);
}

function setLastGoalHash(guildId, hash) {
  const config = ensureGuildConfig(guildId);
  config[guildId].football.lastGoalHash = hash;
  saveConfig(config);
}

function makeHash(data) {
  return JSON.stringify(data);
}

async function fetchFootballLive() {
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) throw new Error("FOOTBALL_API_KEY is missing");

  const res = await fetch("https://v3.football.api-sports.io/fixtures?live=all", {
    headers: {
      "x-apisports-key": apiKey,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Football API error: ${res.status} ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.response || [];
}

async function fetchCricketLive() {
  const apiKey = process.env.CRICKET_API_KEY;
  if (!apiKey) throw new Error("CRICKET_API_KEY is missing");

  const url = `https://api.cricapi.com/v1/currentMatches?apikey=${encodeURIComponent(apiKey)}&offset=0`;

  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json",
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Cricket API error: ${res.status} ${body.slice(0, 200)}`);
      }

      const data = await res.json();
      return data.data || [];
    } catch (err) {
      console.log(`[CRICKET RETRY ${i + 1}]`, err.message);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw new Error("Cricket API unreachable after retries");
}

function buildFootballEmbeds(matches) {
  if (!matches.length) {
    return [
      new EmbedBuilder()
        .setTitle("⚽ Live Football Scores")
        .setDescription("No live football matches right now.")
        .setColor(0x2ecc71)
        .setTimestamp(),
    ];
  }

  return matches.slice(0, 10).map((match) => {
    const home = match.teams?.home?.name || "Home";
    const away = match.teams?.away?.name || "Away";
    const homeGoals = match.goals?.home ?? 0;
    const awayGoals = match.goals?.away ?? 0;
    const league = match.league?.name || "Unknown League";
    const status = match.fixture?.status?.short || "LIVE";
    const elapsed = match.fixture?.status?.elapsed ?? "?";

    let goalInfo = "No event details available.";
    const events = match.events || [];
    const goals = events.filter((e) => e.type === "Goal").slice(-3);

    if (goals.length) {
      goalInfo = goals
        .map((g) => {
          const player = g.player?.name || "Unknown";
          const team = g.team?.name || "Team";
          const minute = g.time?.elapsed ?? "?";
          return `⚽ ${player} (${team}) - ${minute}'`;
        })
        .join("\n");
    }

    return new EmbedBuilder()
      .setTitle(`⚽ ${home} vs ${away}`)
      .setDescription(`**Score:** ${homeGoals} - ${awayGoals}`)
      .addFields(
        { name: "League", value: league, inline: true },
        { name: "Status", value: `${status} • ${elapsed}'`, inline: true },
        { name: "Latest Goal Events", value: goalInfo, inline: false }
      )
      .setColor(0x2ecc71)
      .setTimestamp();
  });
}

function buildCricketEmbeds(matches) {
  const liveish = matches.filter((m) => {
    const status = (m.status || "").toLowerCase();
    return status.includes("live") || status.includes("innings") || status.includes("match");
  });

  if (!liveish.length) {
    return [
      new EmbedBuilder()
        .setTitle("🏏 Live Cricket Scores")
        .setDescription("No live cricket matches right now.")
        .setColor(0xf39c12)
        .setTimestamp(),
    ];
  }

  return liveish.slice(0, 10).map((match) => {
    const name = match.name || "Cricket Match";
    const status = match.status || "Live";
    const venue = match.venue || "Unknown Venue";

    const scoreText =
      Array.isArray(match.score) && match.score.length
        ? match.score
            .map((s) => {
              const inning = s.inning || "Innings";
              const runs = s.r || 0;
              const wickets = s.w ?? 0;
              const overs = s.o ?? 0;
              return `**${inning}** — ${runs}/${wickets} (${overs} ov)`;
            })
            .join("\n")
        : "Score not available yet.";

    return new EmbedBuilder()
      .setTitle(`🏏 ${name}`)
      .setDescription(scoreText)
      .addFields(
        { name: "Status", value: status, inline: false },
        { name: "Venue", value: venue, inline: false }
      )
      .setColor(0xf39c12)
      .setTimestamp();
  });
}

function extractGoalEvents(matches) {
  const events = [];

  for (const match of matches) {
    const fixtureId = match.fixture?.id;
    const home = match.teams?.home?.name || "Home";
    const away = match.teams?.away?.name || "Away";
    const homeGoals = match.goals?.home ?? 0;
    const awayGoals = match.goals?.away ?? 0;

    for (const e of match.events || []) {
      if (e.type !== "Goal") continue;

      const player = e.player?.name || "Unknown";
      const team = e.team?.name || "Team";
      const minute = e.time?.elapsed ?? "?";
      const detail = e.detail || "Goal";

      const signature = `${fixtureId}|${player}|${team}|${minute}|${detail}`;

      events.push({
        signature,
        fixtureId,
        player,
        team,
        minute,
        detail,
        home,
        away,
        scoreLine: `${homeGoals} - ${awayGoals}`,
      });
    }
  }

  return events;
}

function buildGoalAlertEmbed(goal) {
  return new EmbedBuilder()
    .setTitle("⚽ GOAL ALERT!")
    .setDescription(`**${goal.home} vs ${goal.away}**`)
    .addFields(
      { name: "Scorer", value: goal.player, inline: true },
      { name: "Team", value: goal.team, inline: true },
      { name: "Minute", value: `${goal.minute}'`, inline: true },
      { name: "Score", value: goal.scoreLine, inline: false },
      { name: "Type", value: goal.detail, inline: false }
    )
    .setColor(0xe74c3c)
    .setTimestamp();
}

async function getOrCreateScoreboardMessage(guildId, sport, channel, title, color) {
  const settings = getSettings(guildId, sport);

  if (settings.scoreboardMessageId) {
    const existing = await channel.messages.fetch(settings.scoreboardMessageId).catch(() => null);
    if (existing) return existing;
  }

  const starter = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(title)
        .setDescription("Preparing live scoreboard...")
        .setColor(color)
        .setTimestamp(),
    ],
  });

  setScoreboardMessageId(guildId, sport, starter.id);
  return starter;
}

async function postFootballLive(guildId, manual = false) {
  const settings = await getEffectiveSettings(guildId, "football");
  if (!settings.channelId) return { posted: false, reason: "No football channel set" };

  const channel = await _client.channels.fetch(settings.channelId).catch(() => null);
  if (!channel) return { posted: false, reason: "Football channel not found" };

  const matches = await fetchFootballLive();
  const hash = makeHash(
    matches.map((m) => [
      m.fixture?.id,
      m.goals?.home,
      m.goals?.away,
      m.fixture?.status?.elapsed,
      m.fixture?.status?.short,
    ])
  );

  const scoreboard = await getOrCreateScoreboardMessage(
    guildId,
    "football",
    channel,
    "⚽ Live Football Scores",
    0x2ecc71
  );

  const embeds = buildFootballEmbeds(matches);
  await scoreboard.edit({
    content: `Last updated <t:${Math.floor(Date.now() / 1000)}:R>`,
    embeds,
  });

  const currentGoals = extractGoalEvents(matches);
  let previousGoalSignatures = [];

  try {
    previousGoalSignatures = JSON.parse(settings.lastGoalHash || "[]");
  } catch {
    previousGoalSignatures = [];
  }

  const newGoals = currentGoals.filter((g) => !previousGoalSignatures.includes(g.signature));

  if (!manual && newGoals.length) {
    for (const goal of newGoals.slice(0, 5)) {
      await channel.send({ embeds: [buildGoalAlertEmbed(goal)] });
    }
  }

  setLastHash(guildId, "football", hash);
  setLastGoalHash(guildId, JSON.stringify(currentGoals.map((g) => g.signature)));

  return {
    posted: true,
    reason: matches.length ? "Football scoreboard updated." : "No live football matches right now.",
  };
}

async function postCricketLive(guildId, manual = false) {
  const settings = await getEffectiveSettings(guildId, "cricket");
  if (!settings.channelId) return { posted: false, reason: "No cricket channel set" };

  const channel = await _client.channels.fetch(settings.channelId).catch(() => null);
  if (!channel) return { posted: false, reason: "Cricket channel not found" };

  const matches = await fetchCricketLive();
  const hash = makeHash(matches.map((m) => [m.id, m.status, JSON.stringify(m.score || [])]));

  const scoreboard = await getOrCreateScoreboardMessage(
    guildId,
    "cricket",
    channel,
    "🏏 Live Cricket Scores",
    0xf39c12
  );

  const embeds = buildCricketEmbeds(matches);
  await scoreboard.edit({
    content: `Last updated <t:${Math.floor(Date.now() / 1000)}:R>`,
    embeds,
  });

  setLastHash(guildId, "cricket", hash);

  return {
    posted: true,
    reason: matches.length ? "Cricket scoreboard updated." : "No live cricket matches right now.",
  };
}

function stopLoop(guildId, sport) {
  if (activeIntervals[guildId]?.[sport]) {
    clearInterval(activeIntervals[guildId][sport]);
    delete activeIntervals[guildId][sport];
  }
}

function startLoop(guildId, sport) {
  stopLoop(guildId, sport);

  if (!activeIntervals[guildId]) activeIntervals[guildId] = {};

  const settings = getSettings(guildId, sport);
  if (!settings.auto || !settings.channelId) return;

  const runner = sport === "football" ? postFootballLive : postCricketLive;

  activeIntervals[guildId][sport] = setInterval(async () => {
    try {
      await runner(guildId, false);
    } catch (err) {
      console.error(`[SportsLoop ${sport}]`, err.message);
    }
  }, Number(settings.intervalMs));
}

function refreshGuildLoops(guildId) {
  startLoop(guildId, "football");
  startLoop(guildId, "cricket");
}

async function init(client) {
  _client = client;
  const config = getConfig();

  for (const guildId of Object.keys(config)) {
    refreshGuildLoops(guildId);
  }
}

module.exports = {
  init,
  setChannel,
  setAuto,
  setLocked,
  getSettings,
  refreshGuildLoops,
  postFootballLive,
  postCricketLive,
};
