const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const GiveawayRun = require("../models/GiveawayRun");
const GuildConfig = require("../models/GuildConfig");
const {
  buildLiveEmbed,
  buildEndingWarningEmbed,
  buildWinnersEmbed,
  buildNoParticipantsEmbed,
  buildManualPickEmbed
} = require("./embeds");
const { formatDurationDetailed } = require("./duration");

let recoveryInterval = null;
let recoveryStarted = false;
const activeEnds = new Set();

function renderText(template, values) {
  if (!template || !template.trim()) return "";

  return template
    .replace(/\{time\}/gi, values.time ?? "")
    .replace(/\{prize\}/gi, values.prize ?? "")
    .replace(/\{winners\}/gi, String(values.winners ?? ""))
    .replace(/\{token\}/gi, values.token ?? "")
    .replace(/\{winner_mentions\}/gi, values.winnerMentions ?? "");
}

function buildJoinRow(runId, label = "🎉 Join Giveaway", disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(disabled ? `disabled_${runId}` : `join_${runId}`)
      .setLabel(label)
      .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(disabled)
  );
}

async function logToChannel(client, runOrGuildId, message) {
  try {
    let guildId;
    let logChannelId = "";

    if (typeof runOrGuildId === "string") {
      guildId = runOrGuildId;
      const guildConfig = await GuildConfig.findOne({ guildId });
      logChannelId = guildConfig?.logChannelId || "";
    } else {
      guildId = runOrGuildId.guildId;
      logChannelId = runOrGuildId.logChannelId || "";

      if (!logChannelId) {
        const guildConfig = await GuildConfig.findOne({ guildId });
        logChannelId = guildConfig?.logChannelId || "";
      }
    }

    if (!logChannelId) return;

    const channel = await client.channels.fetch(logChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    await channel.send({ content: message }).catch(() => null);
  } catch (error) {
    console.error("logToChannel error:", error);
  }
}

async function updateLiveMessage(client, runId) {
  const run = await GiveawayRun.findById(runId);
  if (!run || !run.statusMessageId) return false;

  const channel = await client.channels.fetch(run.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return false;

  const msg = await channel.messages.fetch(run.statusMessageId).catch(() => null);
  if (!msg) return false;

  let row;

  if (run.status === "ended") {
    row = buildJoinRow(run._id, "Giveaway Ended", true);
  } else if (run.isPaused) {
    row = buildJoinRow(run._id, "Giveaway Paused", true);
  } else {
    row = buildJoinRow(run._id, "🎉 Join Giveaway", false);
  }

  await msg.edit({
    embeds: [buildLiveEmbed(run)],
    components: [row]
  }).catch(() => null);

  return run.status === "running";
}

async function sendWarning(client, runId, type) {
  const run = await GiveawayRun.findById(runId);
  if (!run || run.status !== "running" || run.isPaused) return;

  if (type === 1 && run.warning1Sent) return;
  if (type === 2 && run.warning2Sent) return;

  const channel = await client.channels.fetch(run.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const remaining = Math.max(0, run.endsAt - Date.now());

  const defaultText1 = `@everyone ⏳ The giveaway for **{prize}** is now entering its final phase! There is only **{time}** remaining before it officially ends, so if you haven’t joined yet, this is your moment to jump in and secure your chance to win. The competition is getting intense and more participants are joining every moment, making it harder to win as time passes. Don’t miss this opportunity to be one of the lucky winners. Head over to the giveaway and make sure you’ve entered properly before time runs out. Good luck to everyone participating 🍀🔥`;

  const defaultText2 = `@everyone 🚨 FINAL CALL 🚨 The giveaway for **{prize}** is about to end in just **{time}**. This is your absolute last chance to enter before winners are selected. Once the timer hits zero, entries will be closed and winners will be chosen immediately. If you have not joined yet, you need to act right now or you will miss out completely. The stakes are high and only a few will win, so make sure you are part of it before it's too late. Good luck to everyone, and may the best participants win 🏆🔥`;

  const customText = type === 1 ? run.customEndingMessage1 : run.customEndingMessage2;
  const template = customText && customText.trim()
    ? customText
    : (type === 1 ? defaultText1 : defaultText2);

  const finalText = renderText(template, {
    time: formatDurationDetailed(remaining),
    prize: run.prize,
    winners: run.winnerCount,
    token: run.templateToken,
    winnerMentions: ""
  });

  await channel.send({
    content: finalText,
    embeds: [
      buildEndingWarningEmbed(
        run.prize,
        run.winnerCount,
        formatDurationDetailed(remaining),
        type
      )
    ]
  }).catch(() => null);

  if (type === 1) run.warning1Sent = true;
  if (type === 2) run.warning2Sent = true;
  await run.save();

  await logToChannel(client, run, `⚠️ Warning ${type} sent for giveaway **${run.prize}**.`);
}

function pickWeightedWinners(weightedPool, winnerCount) {
  const winners = [];
  let pool = [...weightedPool];

  while (winners.length < winnerCount && pool.length > 0) {
    const chosenId = pool[Math.floor(Math.random() * pool.length)];
    if (!winners.includes(chosenId)) {
      winners.push(chosenId);
      pool = pool.filter(id => id !== chosenId);
    }
  }

  return winners;
}

async function sendWinnerAnnouncement(channel, run, winners) {
  const customText = run.customWinnerAnnouncement?.trim();

  if (customText) {
    const rendered = renderText(customText, {
      time: "0 seconds",
      prize: run.prize,
      winners: run.winnerCount,
      token: run.templateToken,
      winnerMentions: winners.map(user => `<@${user.id}>`).join(", ")
    });

    await channel.send({ content: rendered }).catch(() => null);
    return;
  }

  await channel.send({
    content: "@everyone",
    embeds: [buildWinnersEmbed(run.prize, winners)]
  }).catch(() => null);
}

async function endGiveawayRandom(client, runId) {
  const id = String(runId);
  if (activeEnds.has(id)) return;
  activeEnds.add(id);

  try {
    const run = await GiveawayRun.findById(runId);
    if (!run || run.status !== "running") return;

    const channel = await client.channels.fetch(run.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    if (!run.joinedUserIds.length) {
      run.status = "ended";
      await run.save();

      await channel.send({
        embeds: [buildNoParticipantsEmbed(run.prize)]
      }).catch(() => null);

      await updateLiveMessage(client, run._id);
      await logToChannel(client, run, `❌ Giveaway ended with no participants for **${run.prize}**.`);
      return;
    }

    const winners = pickWeightedWinners(
      run.joinedUserIds,
      Math.min(run.winnerCount, run.joinedUserIds.length)
    );

    const winnerUsers = [];
    for (const userId of winners) {
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) winnerUsers.push(user);
    }

    run.status = "ended";
    run.winnerIds = winners;
    run.claimDeadline = run.claimTimeoutMs === -1 ? 0 : Date.now() + run.claimTimeoutMs;
    run.winnerClaimed = false;
    await run.save();

    if (!winnerUsers.length) {
      await channel.send({
        embeds: [buildNoParticipantsEmbed(run.prize)]
      }).catch(() => null);

      await updateLiveMessage(client, run._id);
      await logToChannel(client, run, `❌ Giveaway ended but no winner users could be fetched for **${run.prize}**.`);
      return;
    }

    await sendWinnerAnnouncement(channel, run, winnerUsers);

    for (const user of winnerUsers) {
      const dmText = renderText(run.winnerDmMessage || "🎉 You won **{prize}**!", {
        time: "0 seconds", prize: run.prize, winners: run.winnerCount, token: run.templateToken, winnerMentions: `<@${user.id}>`
      });
      await user.send(dmText).catch(() => null);
    }

    await updateLiveMessage(client, run._id);

    const claimText =
      run.claimTimeoutMs === -1
        ? "No limit"
        : `<t:${Math.floor(run.claimDeadline / 1000)}:F>`;

    await logToChannel(
      client,
      run,
      `🎉 Giveaway ended for **${run.prize}**. Winner(s): ${winnerUsers.map(u => `<@${u.id}>`).join(", ")}. Claim deadline: ${claimText}`
    );
  } finally {
    activeEnds.delete(id);
  }
}

async function pickWinnerManually(client, runId, chosenUserId) {
  const run = await GiveawayRun.findById(runId);
  if (!run || run.status !== "running") {
    return { ok: false, message: "❌ No running giveaway found with that message ID." };
  }

  if (!run.joinedUserIds.includes(chosenUserId)) {
    return { ok: false, message: "❌ That user did not join this giveaway." };
  }

  const channel = await client.channels.fetch(run.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    return { ok: false, message: "❌ Giveaway channel not found." };
  }

  const chosenUser = await client.users.fetch(chosenUserId).catch(() => null);
  if (!chosenUser) {
    return { ok: false, message: "❌ User could not be fetched." };
  }

  run.status = "ended";
  run.winnerIds = [chosenUserId];
  run.claimDeadline = run.claimTimeoutMs === -1 ? 0 : Date.now() + run.claimTimeoutMs;
  run.winnerClaimed = false;
  await run.save();

  const customText = run.customWinnerAnnouncement?.trim();

  if (customText) {
    const rendered = renderText(customText, {
      time: "0 seconds",
      prize: run.prize,
      winners: run.winnerCount,
      token: run.templateToken,
      winnerMentions: `<@${chosenUser.id}>`
    });

    await channel.send({ content: rendered }).catch(() => null);
  } else {
    await channel.send({
      content: "@everyone",
      embeds: [buildManualPickEmbed(run.prize, chosenUser)]
    }).catch(() => null);
  }

  const chosenDmText = renderText(run.winnerDmMessage || "🎉 You won **{prize}**!", {
    time: "0 seconds", prize: run.prize, winners: 1, token: run.templateToken, winnerMentions: `<@${chosenUser.id}>`
  });
  await chosenUser.send(chosenDmText).catch(() => null);
  await updateLiveMessage(client, run._id);

  const claimText =
    run.claimTimeoutMs === -1
      ? "No limit"
      : `<t:${Math.floor(run.claimDeadline / 1000)}:F>`;

  await logToChannel(client, run, `👑 Manual winner pick for **${run.prize}**: <@${chosenUser.id}>. Claim deadline: ${claimText}`);

  return { ok: true, message: `✅ Winner manually selected: <@${chosenUser.id}>` };
}

async function pauseGiveawayLifecycle(client, run) {
  run.isPaused = true;
  run.pausedAt = Date.now();
  await run.save();

  await updateLiveMessage(client, run._id);
  await logToChannel(client, run, `⏸️ Giveaway paused for **${run.prize}**.`);
}

async function resumeGiveawayLifecycle(client, run) {
  const pausedDuration = Date.now() - run.pausedAt;

  run.endsAt += pausedDuration;
  run.startedAt += pausedDuration;
  run.isPaused = false;
  run.pausedAt = 0;
  await run.save();

  await updateLiveMessage(client, run._id);
  await logToChannel(client, run, `▶️ Giveaway resumed for **${run.prize}**.`);
}

async function processRunningGiveaway(client, run) {
  if (run.status !== "running") return;

  await updateLiveMessage(client, run._id);

  if (run.isPaused) return;

  const now = Date.now();
  const halfPoint = run.startedAt + Math.floor(run.durationMs / 2);
  const finalPoint = run.startedAt + Math.floor(run.durationMs * 3 / 4);

  if (!run.warning1Sent && now >= halfPoint) {
    await sendWarning(client, run._id, 1);
  }

  if (!run.warning2Sent && now >= finalPoint) {
    await sendWarning(client, run._id, 2);
  }

  if (now >= run.endsAt) {
    await endGiveawayRandom(client, run._id);
  }
}

async function recoveryTick(client) {
  const runningGiveaways = await GiveawayRun.find({ status: "running" });

  for (const run of runningGiveaways) {
    try {
      await processRunningGiveaway(client, run);
    } catch (error) {
      console.error(`Recovery tick error for giveaway ${run._id}:`, error);
    }
  }
}

async function initializeRecoveryEngine(client) {
  if (recoveryStarted) return;
  recoveryStarted = true;

  console.log("🛠️ Starting giveaway recovery engine...");

  await recoveryTick(client);

  recoveryInterval = setInterval(async () => {
    try {
      await recoveryTick(client);
    } catch (error) {
      console.error("Recovery engine interval error:", error);
    }
  }, 5000);

  console.log("✅ Giveaway recovery engine started.");
}

async function scheduleGiveawayLifecycle(client, runId) {
  const run = await GiveawayRun.findById(runId);
  if (!run || run.status !== "running") return false;
  await processRunningGiveaway(client, run);
  return true;
}

module.exports = {
  scheduleGiveawayLifecycle,
  pauseGiveawayLifecycle,
  resumeGiveawayLifecycle,
  endGiveawayRandom,
  pickWinnerManually,
  logToChannel,
  initializeRecoveryEngine
};
