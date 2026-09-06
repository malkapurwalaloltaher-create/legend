const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const AITicketConfig = require("../models/AITicketConfig");

function canManage(member) {
  return Boolean(
    member?.permissions?.has(PermissionFlagsBits.Administrator) ||
    member?.permissions?.has(PermissionFlagsBits.ManageGuild)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("aiticketstatus")
    .setDescription("Show AI ticket system configuration"),

  accessLevel: "admin",
  description: "Show AI ticket system status.",
  usage: "$aiticketstatus",

  async execute(interaction) {
    if (!canManage(interaction.member)) {
      return interaction.reply({ content: "❌ Admin/manager only.", ephemeral: true });
    }

    const config = await AITicketConfig.findOneWithMainFallback({ guildId: interaction.guildId });
    const embed = buildStatusEmbed(config, interaction.guild.name);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  },

  async executePrefix(message) {
    if (!canManage(message.member)) {
      const reply = await message.reply("❌ Admin/manager only.").catch(() => null);
      if (reply) setTimeout(() => reply.delete().catch(() => null), 8000);
      return;
    }

    const config = await AITicketConfig.findOneWithMainFallback({ guildId: message.guildId });
    return message.reply({ embeds: [buildStatusEmbed(config, message.guild.name)] });
  },
};

function buildStatusEmbed(config, guildName) {
  const lines = (config?.types || []).map((type) => {
    return `**${type.label || type.key}**\nCategory: \`${type.categoryId || "not set"}\`\nReview: ${type.reviewChannelId ? `<#${type.reviewChannelId}>` : "`not set`"}`;
  });

  return new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle("🤖 AI Ticket Status")
    .setDescription(lines.length ? lines.join("\n\n") : "No AI ticket config saved yet.")
    .addFields(
      { name: "Enabled", value: String(config?.enabled !== false), inline: true },
      { name: "Final Max", value: String(config?.finalScoreMax || 100), inline: true },
      { name: "Pass Score", value: String(config?.passScore || 100), inline: true },
      { name: "Review Min", value: String(config?.staffReviewMinScore || 75), inline: true },
      { name: "Guild", value: guildName || "Unknown", inline: false }
    )
    .setTimestamp();
}
