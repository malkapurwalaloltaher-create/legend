const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const DashboardGiveawayRun = require("../models/DashboardGiveawayRun");

function buildGiveawayEmbed(run, ended = false) {
  const endsUnix = Math.floor(new Date(run.endsAt).getTime() / 1000);
  const entryCount = Array.isArray(run.entries) ? run.entries.length : 0;
  const winners = Array.isArray(run.winnerTags) && run.winnerTags.length
    ? run.winnerTags.map((winner) => `• ${winner}`).join("\n")
    : "Not picked yet";

  return new EmbedBuilder()
    .setColor(ended ? "#22c55e" : "#8b5cf6")
    .setTitle(ended ? `🎉 Giveaway Ended: ${run.prize}` : `🎉 Giveaway: ${run.prize}`)
    .setDescription(
      [
        run.description || "Click Join to enter!",
        "",
        `**Winners:** ${run.winnersCount}`,
        `**Entries:** ${entryCount}`,
        ended ? `**Winners picked:**\n${winners}` : `**Ends:** <t:${endsUnix}:R>`,
      ].join("\n")
    )
    .setFooter({ text: `Giveaway ID: ${run._id}` })
    .setTimestamp();
}

function buildGiveawayButtons(run, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`gv2_join_${run._id}`)
        .setLabel("Join")
        .setEmoji("🎊")
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`gv2_leave_${run._id}`)
        .setLabel("Leave")
        .setEmoji("🚪")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`gv2_view_${run._id}`)
        .setLabel("Entries")
        .setEmoji("👀")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled)
    ),
  ];
}

function pickWinners(entries, count) {
  const pool = [...entries];
  const winners = [];
  while (pool.length && winners.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(index, 1)[0]);
  }
  return winners;
}

async function handleButton(interaction) {
  const [, action, giveawayId] = String(interaction.customId || "").split("_");
  if (!giveawayId) return false;

  const run = await DashboardGiveawayRun.findById(giveawayId);
  if (!run || run.guildId !== interaction.guildId) {
    await interaction.reply({ content: "❌ This giveaway no longer exists.", ephemeral: true }).catch(() => null);
    return true;
  }

  if (run.status !== "running") {
    await interaction.reply({ content: "❌ This giveaway has already ended.", ephemeral: true }).catch(() => null);
    return true;
  }

  if (action === "join") {
    const exists = run.entries.some((entry) => entry.userId === interaction.user.id);
    if (exists) {
      await interaction.reply({ content: "✅ You are already entered in this giveaway.", ephemeral: true }).catch(() => null);
      return true;
    }

    run.entries.push({ userId: interaction.user.id, username: interaction.user.globalName || interaction.user.username });
    await run.save();
    await interaction.reply({ content: `🎊 You joined **${run.prize}**!`, ephemeral: true }).catch(() => null);
    await interaction.message.edit({ embeds: [buildGiveawayEmbed(run)], components: buildGiveawayButtons(run) }).catch(() => null);
    return true;
  }

  if (action === "leave") {
    const before = run.entries.length;
    run.entries = run.entries.filter((entry) => entry.userId !== interaction.user.id);
    await run.save();
    await interaction.reply({ content: before === run.entries.length ? "ℹ️ You were not entered." : "🚪 You left the giveaway.", ephemeral: true }).catch(() => null);
    await interaction.message.edit({ embeds: [buildGiveawayEmbed(run)], components: buildGiveawayButtons(run) }).catch(() => null);
    return true;
  }

  if (action === "view") {
    await interaction.reply({ content: `👀 **${run.entries.length}** entries for **${run.prize}**.`, ephemeral: true }).catch(() => null);
    return true;
  }

  return false;
}

async function endGiveaway(run, client = null) {
  if (!run || run.status !== "running") return run;

  const winners = pickWinners(run.entries || [], Number(run.winnersCount || 1));
  run.status = "ended";
  run.endedAt = new Date();
  run.winnerIds = winners.map((winner) => winner.userId);
  run.winnerTags = winners.map((winner) => winner.username || winner.userId);
  await run.save();

  if (client && run.channelId && run.messageId) {
    const channel = await client.channels.fetch(run.channelId).catch(() => null);
    const message = channel ? await channel.messages.fetch(run.messageId).catch(() => null) : null;
    if (message) {
      await message.edit({ embeds: [buildGiveawayEmbed(run, true)], components: buildGiveawayButtons(run, true) }).catch(() => null);
      const winnerText = winners.length ? winners.map((winner) => `<@${winner.userId}>`).join(", ") : "No valid entries.";
      await channel.send(`🎉 Giveaway ended for **${run.prize}**! Winner(s): ${winnerText}`).catch(() => null);
    }
  }

  return run;
}

module.exports = {
  buildGiveawayEmbed,
  buildGiveawayButtons,
  handleButton,
  endGiveaway,
};
