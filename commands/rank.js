const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function xpNeededForLevel(level) {
  return Math.pow(Number(level || 0) / 0.1, 2);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Check your level and XP")
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("User to check")
        .setRequired(false)
    ),

  async execute(interaction) {
    const DashboardLevelUser = require("../models/DashboardLevelUser");

    const target = interaction.options.getUser("user") || interaction.user;

    const data = await DashboardLevelUser.findOne({
      guildId: interaction.guildId,
      userId: target.id,
    });

    if (!data) {
      return interaction.reply({
        content: target.id === interaction.user.id
          ? "❌ You do not have any XP yet. Start chatting to gain XP!"
          : "❌ That user does not have any XP yet.",
        ephemeral: true,
      });
    }

    const currentLevel = Number(data.level || 0);
    const currentXp = Number(data.xp || 0);
    const nextLevel = currentLevel + 1;
    const nextLevelXp = Math.ceil(xpNeededForLevel(nextLevel));
    const needed = Math.max(0, nextLevelXp - currentXp);

    const rankCount = await DashboardLevelUser.countDocuments({
      guildId: interaction.guildId,
      xp: { $gt: currentXp },
    });

    const rank = rankCount + 1;

    const embed = new EmbedBuilder()
      .setColor("#8b5cf6")
      .setTitle(`🏆 ${target.username}'s Rank`)
      .setThumbnail(target.displayAvatarURL({ extension: "png", size: 256 }))
      .setDescription(
        [
          `**Level:** ${currentLevel}`,
          `**XP:** ${currentXp}`,
          `**Server Rank:** #${rank}`,
          `**XP needed for next level:** ${needed}`,
        ].join("\n")
      )
      .setFooter({ text: "Keep chatting to level up!" })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args) {
    const DashboardLevelUser = require("../models/DashboardLevelUser");

    const target = message.mentions.users.first() || message.author;

    const data = await DashboardLevelUser.findOne({
      guildId: message.guildId,
      userId: target.id,
    });

    if (!data) {
      return message.reply(
        target.id === message.author.id
          ? "❌ You do not have any XP yet. Start chatting to gain XP!"
          : "❌ That user does not have any XP yet."
      );
    }

    const currentLevel = Number(data.level || 0);
    const currentXp = Number(data.xp || 0);
    const nextLevel = currentLevel + 1;
    const nextLevelXp = Math.ceil(xpNeededForLevel(nextLevel));
    const needed = Math.max(0, nextLevelXp - currentXp);

    const rankCount = await DashboardLevelUser.countDocuments({
      guildId: message.guildId,
      xp: { $gt: currentXp },
    });

    const rank = rankCount + 1;

    const embed = new EmbedBuilder()
      .setColor("#8b5cf6")
      .setTitle(`🏆 ${target.username}'s Rank`)
      .setThumbnail(target.displayAvatarURL({ extension: "png", size: 256 }))
      .setDescription(
        [
          `**Level:** ${currentLevel}`,
          `**XP:** ${currentXp}`,
          `**Server Rank:** #${rank}`,
          `**XP needed for next level:** ${needed}`,
        ].join("\n")
      )
      .setFooter({ text: "Keep chatting to level up!" })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
