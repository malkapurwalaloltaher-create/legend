const { EmbedBuilder } = require("discord.js");
const { formatDurationDetailed } = require("./duration");

function getColorByTime(run) {
  const now = Date.now();
  const total = Math.max(1, Number(run.durationMs || 0));
  const elapsed = now - run.startedAt;
  const progress = elapsed / total;

  if (progress < 0.5) return 0x2ecc71; // 🟢 green
  if (progress < 0.8) return 0xf1c40f; // 🟡 yellow
  return 0xe74c3c; // 🔴 red
}

function getProgressBar(run) {
  const total = Math.max(1, Number(run.durationMs || 0));
  const elapsed = Date.now() - run.startedAt;
  const percent = Math.min(1, elapsed / total);

  const filled = Math.floor(percent * 20);
  const empty = 20 - filled;

  return "█".repeat(filled) + "░".repeat(empty) + ` ${(percent * 100).toFixed(0)}%`;
}

function getStatus(run) {
  if (run.status === "ended") return "ENDED";
  if (run.isPaused) return "PAUSED";

  const now = Date.now();
  const half = run.startedAt + run.durationMs / 2;
  const final = run.startedAt + run.durationMs * 0.75;

  if (now >= final) return "FINAL";
  if (now >= half) return "MIDWAY";

  return "STARTED";
}

function buildLiveEmbed(run) {
  const remaining = Math.max(0, run.endsAt - Date.now());

  return new EmbedBuilder()
    .setColor(getColorByTime(run))
    .setTitle("⚡ GiveX Live Giveaway")
    .setDescription("Giveaway is active and updating live.")
    .addFields(
      { name: "🎁 Prize", value: run.prize, inline: false },
      { name: "🎤 Hosted By", value: run.hostDisplay || "GiveX", inline: false },
      {
        name: "🏆 Winners",
        value: String(run.winnerCount),
        inline: true
      },
      {
        name: "👥 Participants",
        value: String(run.joinedUserIds.length),
        inline: true
      },
      {
        name: "📌 Status",
        value: getStatus(run),
        inline: true
      },
      {
        name: "🛡️ Requirements",
        value:
          `Role: ${run.requiredRoleId ? `<@&${run.requiredRoleId}>` : "None"}\n` +
          `Account Age: ${run.minAccountAgeDays || 0}+ day(s)\n` +
          `Staff Participation: ${run.staffParticipation ? "Allowed" : "Not Allowed"}`,
        inline: false
      },
      {
        name: "⏳ Time Remaining",
        value: formatDurationDetailed(remaining),
        inline: false
      },
      {
        name: "📩 Claim Time",
        value: run.claimTimeoutMs === -1 ? "No limit" : formatDurationDetailed(run.claimTimeoutMs),
        inline: false
      },
      {
        name: "📊 Progress",
        value: getProgressBar(run),
        inline: false
      },
      {
        name: "🕒 Ends At",
        value: `<t:${Math.floor(run.endsAt / 1000)}:F>`,
        inline: false
      }
    )
    .setFooter({ text: "Updates every 5 seconds" });
}

function buildEndingWarningEmbed(prize, winners, time, type) {
  return new EmbedBuilder()
    .setColor(type === 1 ? 0xf1c40f : 0xe74c3c)
    .setTitle(type === 1 ? "⏳ Giveaway Midway" : "🚨 Final Call")
    .setDescription(
      `Prize: **${prize}**\nWinners: **${winners}**\nTime Left: **${time}**`
    );
}

function buildWinnersEmbed(prize, winners) {
  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("🎉 Giveaway Ended")
    .setDescription(
      `Prize: **${prize}**\nWinner(s): ${winners.map(u => `<@${u.id}>`).join(", ")}`
    );
}

function buildNoParticipantsEmbed(prize) {
  return new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("❌ Giveaway Ended")
    .setDescription(`No participants joined for **${prize}**.`);
}

function buildManualPickEmbed(prize, user) {
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("👑 Winner Selected")
    .setDescription(`Prize: **${prize}**\nWinner: <@${user.id}>`);
}

module.exports = {
  buildLiveEmbed,
  buildStatusEmbed: buildLiveEmbed,
  buildEndingWarningEmbed,
  buildWinnersEmbed,
  buildNoParticipantsEmbed,
  buildManualPickEmbed
};
