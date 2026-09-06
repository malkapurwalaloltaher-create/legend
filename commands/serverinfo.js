const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function buildEmbed(guild) {
  const createdAt = `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`;
  return new EmbedBuilder()
    .setTitle(`📊 ${guild.name}`)
    .setThumbnail(guild.iconURL({ size: 256 }))
    .setColor(0x5865f2)
    .addFields(
      { name: "👑 Owner", value: `<@${guild.ownerId}>`, inline: true },
      { name: "👥 Members", value: `${guild.memberCount}`, inline: true },
      { name: "🔒 Verification", value: `${guild.verificationLevel}`, inline: true },
      { name: "💬 Channels", value: `${guild.channels.cache.size}`, inline: true },
      { name: "🎭 Roles", value: `${guild.roles.cache.size}`, inline: true },
      { name: "😀 Emojis", value: `${guild.emojis.cache.size}`, inline: true },
      { name: "📅 Created", value: createdAt },
    )
    .setFooter({ text: `Server ID: ${guild.id}` })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Show information about this server"),

  async execute(interaction) {
    await interaction.reply({ embeds: [buildEmbed(interaction.guild)] });
  },

  async executePrefix(message) {
    await message.reply({ embeds: [buildEmbed(message.guild)] });
  },
};
