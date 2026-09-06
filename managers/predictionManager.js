const fs = require("fs");
const path = require("path");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const CONFIG_PATH = path.join(__dirname, "../data/predictions.json");
const POINTS_PER_WIN = 10;

function ensureJsonFile(filePath, defaultValue) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
}

function getData() {
  ensureJsonFile(CONFIG_PATH, { active: {}, points: {} });
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    parsed.active ||= {};
    parsed.points ||= {};
    return parsed;
  } catch {
    return { active: {}, points: {} };
  }
}

function saveData(data) {
  ensureJsonFile(CONFIG_PATH, { active: {}, points: {} });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

function countVotes(votes) {
  const counts = [0, 0];
  for (const choice of Object.values(votes || {})) {
    if (choice === 0) counts[0] += 1;
    if (choice === 1) counts[1] += 1;
  }
  return counts;
}

function buildPredictionButtons(open = true) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pred_vote_0")
        .setLabel("Vote Option 1")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!open),
      new ButtonBuilder()
        .setCustomId("pred_vote_1")
        .setLabel("Vote Option 2")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!open)
    ),
  ];
}

function buildPredictionEmbed(prediction, options = {}) {
  const counts = countVotes(prediction.votes || {});
  const closed = options.closed || false;
  const winnerIndex = Number.isInteger(options.winnerIndex) ? options.winnerIndex : null;

  const embed = new EmbedBuilder()
    .setTitle("💰 Prediction")
    .setDescription(prediction.question)
    .addFields(
      {
        name: `1️⃣ ${prediction.options[0]}`,
        value: `Votes: **${counts[0]}**`,
        inline: false,
      },
      {
        name: `2️⃣ ${prediction.options[1]}`,
        value: `Votes: **${counts[1]}**`,
        inline: false,
      }
    )
    .setColor(closed ? 0x95a5a6 : 0x9b59b6)
    .setTimestamp();

  if (closed && winnerIndex !== null) {
    embed.addFields({
      name: "🏆 Winner",
      value: prediction.options[winnerIndex],
      inline: false,
    });
  }

  if (closed) {
    embed.setFooter({ text: "Prediction closed" });
  } else {
    embed.setFooter({ text: "Click a button to vote" });
  }

  return embed;
}

function startPrediction(guildId, channelId, messageId, question, option1, option2) {
  const data = getData();

  if (data.active[guildId]) {
    return { ok: false, reason: "A prediction is already active in this server." };
  }

  data.active[guildId] = {
    guildId,
    channelId,
    messageId,
    question,
    options: [option1, option2],
    votes: {},
    open: true,
    createdAt: Date.now(),
  };

  data.points[guildId] ||= {};
  saveData(data);

  return { ok: true, prediction: data.active[guildId] };
}

function getActivePrediction(guildId) {
  const data = getData();
  return data.active[guildId] || null;
}

function recordVote(guildId, userId, optionIndex) {
  const data = getData();
  const active = data.active[guildId];

  if (!active || !active.open) {
    return { ok: false, reason: "No active prediction right now." };
  }

  if (![0, 1].includes(optionIndex)) {
    return { ok: false, reason: "Invalid vote option." };
  }

  active.votes[userId] = optionIndex;
  saveData(data);

  return { ok: true, prediction: active };
}

function closePrediction(guildId, winnerIndex) {
  const data = getData();
  const active = data.active[guildId];

  if (!active) {
    return { ok: false, reason: "No active prediction to close." };
  }

  if (![0, 1].includes(winnerIndex)) {
    return { ok: false, reason: "Winner must be option 1 or option 2." };
  }

  const winners = [];
  data.points[guildId] ||= {};

  for (const [userId, choice] of Object.entries(active.votes || {})) {
    if (choice === winnerIndex) {
      data.points[guildId][userId] = (data.points[guildId][userId] || 0) + POINTS_PER_WIN;
      winners.push(userId);
    }
  }

  const closedPrediction = {
    ...active,
    open: false,
  };

  delete data.active[guildId];
  saveData(data);

  return {
    ok: true,
    prediction: closedPrediction,
    winners,
    winnerIndex,
  };
}

function getLeaderboard(guildId) {
  const data = getData();
  const points = data.points[guildId] || {};

  return Object.entries(points)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

module.exports = {
  startPrediction,
  getActivePrediction,
  recordVote,
  closePrediction,
  getLeaderboard,
  buildPredictionEmbed,
  buildPredictionButtons,
};
