const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the server XP leaderboard"),

  async execute(interaction) {
    const DashboardLevelUser = require("../models/DashboardLevelUser");

    const topUsers = await DashboardLevelUser.find({
      guildId: interaction.guildId,
    })
      .sort({ xp: -1 })
      .limit(10);

    if (!topUsers.length) {
      return interaction.reply({
        content: "❌ No leaderboard data yet. Members need to chat first!",
        ephemeral: true,
      });
    }

    const lines = topUsers.map((user, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;
      return `${medal} <@${user.userId}> — **Level ${user.level || 0}** • ${user.xp || 0} XP`;
    });

    const embed = new EmbedBuilder()
      .setColor("#8b5cf6")
      .setTitle("🏆 Server Leaderboard")
      .setDescription(lines.join("\n"))
      .setFooter({ text: "Top 10 members by XP" })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message) {
    const DashboardLevelUser = require("../models/DashboardLevelUser");

    const topUsers = await DashboardLevelUser.find({
      guildId: message.guildId,
    })
      .sort({ xp: -1 })
      .limit(10);

    if (!topUsers.length) {
      return message.reply("❌ No leaderboard data yet. Members need to chat first!");
    }

    const lines = topUsers.map((user, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;
      return `${medal} <@${user.userId}> — **Level ${user.level || 0}** • ${user.xp || 0} XP`;
    });

    const embed = new EmbedBuilder()
      .setColor("#8b5cf6")
      .setTitle("🏆 Server Leaderboard")
      .setDescription(lines.join("\n"))
      .setFooter({ text: "Top 10 members by XP" })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
