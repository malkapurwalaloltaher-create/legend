const DashboardGiveawayRun = require("../models/DashboardGiveawayRun");

async function handleButton(interaction) {
  const customId = String(interaction.customId || "");
  if (!customId.startsWith("dash_ga_")) return false;

  const parts = customId.split("_");
  const action = parts[2];
  const runId = parts.slice(3).join("_");

  const run = await DashboardGiveawayRun.findById(runId).catch(() => null);
  if (!run || run.guildId !== interaction.guildId) {
    await interaction.reply({ content: "❌ Giveaway not found.", ephemeral: true }).catch(() => null);
    return true;
  }

  if (action === "entries") {
    await interaction.reply({
      content: `🎉 **${run.prize}** currently has **${run.entries?.length || 0}** entries.`,
      ephemeral: true,
    }).catch(() => null);
    return true;
  }

  if (action !== "join") return false;

  if (run.status !== "running") {
    await interaction.reply({ content: "❌ This giveaway is not running anymore.", ephemeral: true }).catch(() => null);
    return true;
  }

  if (new Date(run.endsAt).getTime() <= Date.now()) {
    run.status = "ended";
    run.endedAt = new Date();
    await run.save().catch(() => null);
    await interaction.reply({ content: "❌ This giveaway has already ended.", ephemeral: true }).catch(() => null);
    return true;
  }

  const alreadyJoined = (run.entries || []).some((entry) => entry.userId === interaction.user.id);
  if (alreadyJoined) {
    await interaction.reply({ content: "❌ You already joined this giveaway.", ephemeral: true }).catch(() => null);
    return true;
  }

  run.entries.push({
    userId: interaction.user.id,
    username: interaction.user.tag || interaction.user.username || "Unknown User",
    joinedAt: new Date(),
  });
  await run.save();

  await interaction.reply({
    content: `✅ You joined **${run.prize}**! Good luck 🎉`,
    ephemeral: true,
  }).catch(() => null);
  return true;
}

module.exports = { handleButton };
