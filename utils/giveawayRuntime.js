const GiveawayRun = require("../models/GiveawayRun");
const {
  buildStatusEmbed,
  buildWinnersEmbed,
  buildNoParticipantsEmbed,
  buildManualPickEmbed
} = require("./embeds");
const { formatDurationDetailed } = require("./duration");

function renderText(template, values) {
  if (!template || !template.trim()) return "";

  return template
    .replace(/\{time\}/gi, values.time ?? "")
    .replace(/\{prize\}/gi, values.prize ?? "")
    .replace(/\{winners\}/gi, String(values.winners ?? ""))
    .replace(/\{token\}/gi, values.token ?? "")
    .replace(/\{winner_mentions\}/gi, values.winnerMentions ?? "");
}

function getRemainingMs(run) {
  return Math.max(0, new Date(run.endsAt).getTime() - Date.now());
}

async function updateStatusMessage(client, runId) {
  const run = await GiveawayRun.findById(runId);
  if (!run || !run.statusMessageId) return false;

  const channel = await client.channels.fetch(run.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return false;

  const statusMessage = await channel.messages.fetch(run.statusMessageId).catch(() => null);
  if (!statusMessage) return false;

  await statusMessage.edit({
    embeds: [buildStatusEmbed(run)],
    content: ""
  }).catch(() => null);

  return run.status === "running";
}

async function sendWarning(client, runId, type) {
  const run = await GiveawayRun.findById(runId);
  if (!run || run.status !== "running") return;

  if (type === 1 && run.warning1Sent) return;
  if (type === 2 && run.warning2Sent) return;

  const channel = await client.channels.fetch(run.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const remaining = getRemainingMs(run);

  const defaultText =
    type === 1
      ? `@everyone ⏳ Giveaway update for **{prize}**! Only **{time}** left. React with 🎉 now if you have not entered yet.`
      : `@everyone ⚠️ Final call for **{prize}**! Only **{time}** left. There will be **{winners}** winner(s).`;

  const customText = type === 1 ? run.customEndingMessage1 : run.customEndingMessage2;
  const finalText = renderText(customText && customText.trim() ? customText : defaultText, {
    time: formatDurationDetailed(remaining),
    prize: run.prize,
    winners: run.winnerCount,
    token: run.templateToken,
    winnerMentions: ""
  });

  await channel.send({
    content: finalText
  }).catch(() => null);

  if (type === 1) run.warning1Sent = true;
  if (type === 2) run.warning2Sent = true;
  await run.save();
}

async function finishRunWithNoParticipants(client, run, channel) {
  run.status = "ended";
  run.endedAt = new Date();
  await run.save();

  await channel.send({
    embeds: [buildNoParticipantsEmbed(run.prize)]
  }).catch(() => null);

  await updateStatusMessage(client, run._id);
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

    await channel.send({
      content: rendered
    }).catch(() => null);

    return;
  }

  await channel.send({
    content: "@everyone",
    embeds: [buildWinnersEmbed(run.prize, winners)]
  }).catch(() => null);
}

async function endGiveawayRandom(client, runId) {
  const run = await GiveawayRun.findById(runId);
  if (!run || run.status !== "running") return;

  const channel = await client.channels.fetch(run.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const giveawayMessage = await channel.messages.fetch(run.messageId).catch(() => null);

  if (!giveawayMessage) {
    run.status = "ended";
    run.endedAt = new Date();
    await run.save();
    await channel.send("❌ Giveaway message could not be found when ending the giveaway.").catch(() => null);
    await updateStatusMessage(client, run._id);
    return;
  }

  const reaction = giveawayMessage.reactions.cache.get("🎉");

  if (!reaction) {
    await finishRunWithNoParticipants(client, run, channel);
    return;
  }

  const users = await reaction.users.fetch().catch(() => null);
  if (!users) {
    await finishRunWithNoParticipants(client, run, channel);
    return;
  }

  const participants = users.filter(user => !user.bot);

  if (participants.size === 0) {
    await finishRunWithNoParticipants(client, run, channel);
    return;
  }

  const participantArray = [...participants.values()];
  const winnerCount = Math.min(run.winnerCount, participantArray.length);
  const winners = [];

  while (winners.length < winnerCount) {
    const randomUser = participantArray[Math.floor(Math.random() * participantArray.length)];
    if (!winners.find(user => user.id === randomUser.id)) {
      winners.push(randomUser);
    }
  }

  run.status = "ended";
  run.endedAt = new Date();
  run.winnerIds = winners.map(user => user.id);
  run.participantIds = participantArray.map(user => user.id);
  await run.save();

  await sendWinnerAnnouncement(channel, run, winners);

  for (const winner of winners) {
    await winner.send(run.winnerDmMessage).catch(() => null);
  }

  await updateStatusMessage(client, run._id);
}

async function pickWinnerManually(client, runId, chosenUserId) {
  const run = await GiveawayRun.findById(runId);
  if (!run || run.status !== "running") {
    return { ok: false, message: "❌ No running giveaway found for that message ID." };
  }

  const channel = await client.channels.fetch(run.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    return { ok: false, message: "❌ Giveaway channel not found." };
  }

  const giveawayMessage = await channel.messages.fetch(run.messageId).catch(() => null);
  if (!giveawayMessage) {
    return { ok: false, message: "❌ Giveaway message not found." };
  }

  const reaction = giveawayMessage.reactions.cache.get("🎉");
  if (!reaction) {
    return { ok: false, message: "❌ No one reacted to this giveaway." };
  }

  const users = await reaction.users.fetch().catch(() => null);
  if (!users) {
    return { ok: false, message: "❌ Could not fetch participants." };
  }

  const participants = users.filter(user => !user.bot);
  const participantArray = [...participants.values()];

  const chosenUser = participantArray.find(user => user.id === chosenUserId);
  if (!chosenUser) {
    return { ok: false, message: "❌ That user did not react to the giveaway message." };
  }

  run.status = "ended";
  run.endedAt = new Date();
  run.winnerIds = [chosenUser.id];
  run.participantIds = participantArray.map(user => user.id);
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

    await channel.send({
      content: rendered
    }).catch(() => null);
  } else {
    await channel.send({
      content: "@everyone",
      embeds: [buildManualPickEmbed(run.prize, chosenUser)]
    }).catch(() => null);
  }

  await chosenUser.send(run.winnerDmMessage).catch(() => null);
  await updateStatusMessage(client, run._id);

  return { ok: true, message: `✅ Winner manually selected: <@${chosenUser.id}>` };
}

function scheduleGiveawayLifecycle(client, runId, durationMs) {
  const intervalMs = 2 * 60 * 1000;

  const updater = setInterval(async () => {
    const keepRunning = await updateStatusMessage(client, runId);
    if (!keepRunning) {
      clearInterval(updater);
    }
  }, intervalMs);

  setTimeout(async () => {
    await sendWarning(client, runId, 1);
  }, Math.floor(durationMs / 2));

  setTimeout(async () => {
    await sendWarning(client, runId, 2);
  }, Math.floor(durationMs * 3 / 4));

  setTimeout(async () => {
    await endGiveawayRandom(client, runId);
    clearInterval(updater);
  }, durationMs);
}

module.exports = {
  buildStatusEmbed,
  scheduleGiveawayLifecycle,
  pickWinnerManually
};
