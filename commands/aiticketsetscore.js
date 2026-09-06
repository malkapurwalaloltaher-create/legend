const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const AITicketConfig = require("../models/AITicketConfig");

function canManage(member) {
  return Boolean(
    member?.permissions?.has(PermissionFlagsBits.Administrator) ||
    member?.permissions?.has(PermissionFlagsBits.ManageGuild)
  );
}

async function setScores(guild, passScore, staffReviewMinScore, userId = "", autoApproveEnabled = null, autoApproveRoleId = null) {
  let config = await AITicketConfig.findOneWithMainFallback({ guildId: guild.id });
  if (!config) config = new AITicketConfig({ guildId: guild.id, guildName: guild.name });

  config.guildName = guild.name;
  config.passScore = Math.max(1, Math.min(125, Number(passScore || 100)));
  config.staffReviewMinScore = Math.max(0, Math.min(config.passScore, Number(staffReviewMinScore || 75)));
  if (autoApproveEnabled !== null) config.autoApproveEnabled = Boolean(autoApproveEnabled);
  if (autoApproveRoleId !== null) config.autoApproveRoleId = String(autoApproveRoleId || "").replace(/\D/g, "");

  config.updatedBy = userId;
  config.updatedAt = new Date();
  await config.save();

  return config;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("aiticketsetscore")
    .setDescription("Set AI ticket pass/review score thresholds")
    .addIntegerOption((opt) => opt.setName("pass_score").setDescription("Pass score, default 100").setRequired(true))
    .addIntegerOption((opt) => opt.setName("review_min").setDescription("Review zone minimum, default 75").setRequired(true))
    .addBooleanOption((opt) => opt.setName("auto_approve").setDescription("Enable auto approve role if score passes").setRequired(false))
    .addStringOption((opt) => opt.setName("auto_approve_role").setDescription("Role ID to give when auto approved").setRequired(false)),

  accessLevel: "admin",
  description: "Set AI ticket score thresholds.",
  usage: "$aiticketsetscore 100 75",

  async execute(interaction) {
    if (!canManage(interaction.member)) return interaction.reply({ content: "❌ Admin/manager only.", ephemeral: true });
    const passScore = interaction.options.getInteger("pass_score");
    const reviewMin = interaction.options.getInteger("review_min");
    const autoApprove = interaction.options.getBoolean("auto_approve");
    const autoApproveRole = interaction.options.getString("auto_approve_role");
    const config = await setScores(interaction.guild, passScore, reviewMin, interaction.user.id, autoApprove, autoApproveRole);
    return interaction.reply({
      content: `✅ AI ticket scores updated. Pass: **${config.passScore}**, Review min: **${config.staffReviewMinScore}**, Auto approve: **${config.autoApproveEnabled ? "ON" : "OFF"}**${config.autoApproveRoleId ? `, Role: <@&${config.autoApproveRoleId}>` : ""}`,
      ephemeral: true,
    });
  },

  async executePrefix(message, args) {
    if (!canManage(message.member)) {
      const reply = await message.reply("❌ Admin/manager only.").catch(() => null);
      if (reply) setTimeout(() => reply.delete().catch(() => null), 8000);
      return;
    }

    const passScore = Number(args[0] || 100);
    const reviewMin = Number(args[1] || 75);
    const autoApproveEnabled = ["on", "true", "yes", "enable", "enabled"].includes(String(args[2] || "").toLowerCase());
    const autoApproveRoleId = args[3] || null;
    const config = await setScores(message.guild, passScore, reviewMin, message.author.id, args[2] ? autoApproveEnabled : null, autoApproveRoleId);
    return message.reply(`✅ AI ticket scores updated. Pass: **${config.passScore}**, Review min: **${config.staffReviewMinScore}**, Auto approve: **${config.autoApproveEnabled ? "ON" : "OFF"}**${config.autoApproveRoleId ? `, Role: <@&${config.autoApproveRoleId}>` : ""}`);
  },
};
