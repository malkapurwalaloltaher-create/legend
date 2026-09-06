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
    .setName("gxview")
    .setDescription("View a saved giveaway template")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt =>
      opt.setName("token").setDescription("Saved token").setRequired(true)
    ),

  async execute(interaction) {
    if (!(await ensureAdmin(interaction))) return;

    const token = interaction.options.getString("token");

    const template = await GiveawayTemplate.findOne({
      guildId: interaction.guild.id,
      token
    });

    if (!template) {
      return interaction.reply({
        content: "❌ No template found with that token.",
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("🎁 Giveaway Template")
      .addFields(
        { name: "Token", value: template.token, inline: true },
        { name: "Prize", value: template.prize, inline: true },
        { name: "Winners", value: String(template.winnerCount), inline: true },
        { name: "Duration", value: formatDuration(template.durationMs), inline: true },
        { name: "Channel", value: `<#${template.channelId}>`, inline: true },
        { name: "Hosted By", value: template.hostDisplay || "GiveX System", inline: true },
        { name: "Required Role", value: template.requiredRoleId ? `<@&${template.requiredRoleId}>` : "None", inline: true },
        { name: "Min Account Age", value: `${template.minAccountAgeDays ?? 3} day(s)`, inline: true },
        { name: "Staff Participation", value: template.staffParticipation ? "Yes" : "No", inline: true }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};
