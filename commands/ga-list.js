const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");

const { ensureAdmin } = require("../utils/adminOnly");
const GiveawayTemplate = require("../models/GiveawayTemplate");
const { formatDuration } = require("../utils/duration");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gxlist")
    .setDescription("List saved giveaway templates")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!(await ensureAdmin(interaction))) return;

    const templates = await GiveawayTemplate.find({
      guildId: interaction.guild.id
    }).sort({ createdAt: 1 });

    if (!templates.length) {
      return interaction.reply({
        content: "❌ No saved giveaways found.",
        ephemeral: true
      });
    }

    const lines = templates.map(t =>
      `**Token:** ${t.token} | **Prize:** ${t.prize} | **Duration:** ${formatDuration(t.durationMs)} | **Winners:** ${t.winnerCount} | **Host:** ${t.hostDisplay || "GiveX System"}`
    );

    const embed = new EmbedBuilder()
      .setTitle("📋 Saved Giveaways")
      .setDescription(lines.join("\n").slice(0, 4096));

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};
