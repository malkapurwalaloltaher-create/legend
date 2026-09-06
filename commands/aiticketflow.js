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
    .setName("aiticketflow")
    .setDescription("Show AI ticket applicant commands and flow settings"),

  accessLevel: "admin",
  description: "Show AI ticket flow info.",
  usage: "$aiticketflow",

  async execute(interaction) {
    if (!canManage(interaction.member)) {
      return interaction.reply({ content: "❌ Admin/manager only.", ephemeral: true });
    }

    const config = await AITicketConfig.findOneWithMainFallback({ guildId: interaction.guildId });
    return interaction.reply({ embeds: [buildEmbed(config)], ephemeral: true });
  },

  async executePrefix(message) {
    if (!canManage(message.member)) {
      const reply = await message.reply("❌ Admin/manager only.").catch(() => null);
      if (reply) setTimeout(() => reply.delete().catch(() => null), 8000);
      return;
    }

    const config = await AITicketConfig.findOneWithMainFallback({ guildId: message.guildId });
    return message.reply({ embeds: [buildEmbed(config)] });
  },
};

function buildEmbed(config) {
  return new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle("🤖 AI Ticket Flow")
    .setDescription([
      "**Applicant commands:**",
      "`$next` — save current answer and go to next question",
      "`$back` — go back one question",
      "`$finish` — finish early and create review",
      "`$cancelapplication` — cancel AI flow",
      "",
      "**Current Settings:**",
      `Require $next: **${config?.requireNextCommand !== false ? "ON" : "OFF"}**`,
      `Auto approve: **${config?.autoApproveEnabled ? "ON" : "OFF"}**`,
      `Auto approve role: ${config?.autoApproveRoleId ? `<@&${config.autoApproveRoleId}>` : "`not set`"}`,
      `AI-copy detection: **${config?.aiCopyDetectionEnabled !== false ? "ON" : "OFF"}**`,
      `AI-copy score cap: **${config?.aiCopyScoreCap || 7}/10**`,
    ].join("\n"))
    .setTimestamp();
}
