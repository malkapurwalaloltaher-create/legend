const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function safeRequire(modulePath, fallback) {
  try {
    return require(modulePath);
  } catch (error) {
    console.warn(`[Version Command] Could not load ${modulePath}:`, error.message);
    return fallback;
  }
}

const versionInfo = safeRequire("../config/version", {
  version: "20.2.1",
  buildName: "Legendary Bot",
  codename: "Unknown",
  updatedAt: "Unknown",
});
const changelog = safeRequire("../config/changelog", []);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("version")
    .setDescription("Show the current Legendary Bot version."),

  async execute(interaction) {
    try {
      const latest = changelog[0];

      const embed = new EmbedBuilder()
        .setTitle("🔥 Legendary Bot Version")
        .setColor("#8b5cf6")
        .setDescription(
          [
            `**Version:** ${versionInfo.version}`,
            `**Build:** ${versionInfo.buildName}`,
            `**Codename:** ${versionInfo.codename}`,
            `**Updated:** ${versionInfo.updatedAt}`,
            "",
            latest
              ? `**Latest Update:** ${latest.title}`
              : "**Latest Update:** No changelog found.",
          ].join("\n")
        )
        .setFooter({ text: "Legendary Bot Dashboard Pro" })
        .setTimestamp();

      if (interaction.deferred || interaction.replied) {
        return interaction.followUp({ embeds: [embed], ephemeral: false });
      }

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("[Version Command Error]", error);

      if (interaction.deferred || interaction.replied) {
        return interaction.followUp({
          content: "❌ Version command failed.",
          ephemeral: true,
        });
      }

      return interaction.reply({
        content: "❌ Version command failed.",
        ephemeral: true,
      });
    }
  },

  async executePrefix(message) {
    try {
      const latest = changelog[0];

      const embed = new EmbedBuilder()
        .setTitle("🔥 Legendary Bot Version")
        .setColor("#8b5cf6")
        .setDescription(
          [
            `**Version:** ${versionInfo.version}`,
            `**Build:** ${versionInfo.buildName}`,
            `**Codename:** ${versionInfo.codename}`,
            `**Updated:** ${versionInfo.updatedAt}`,
            "",
            latest
              ? `**Latest Update:** ${latest.title}`
              : "**Latest Update:** No changelog found.",
          ].join("\n")
        )
        .setFooter({ text: "Legendary Bot Dashboard Pro" })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("[Version Prefix Error]", error);
      return message.reply("❌ Version command failed.");
    }
  },
};
