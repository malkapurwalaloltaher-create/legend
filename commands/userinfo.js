const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function buildEmbed(member) {
  const user = member.user;
  const joinedAt = member.joinedTimestamp
    ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`
    : "Unknown";
  const createdAt = `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`;
  const roles = member.roles.cache
    .filter((r) => r.name !== "@everyone")
    .map((r) => r.toString())
    .join(", ") || "None";

  return new EmbedBuilder()
    .setTitle(`👤 ${user.username}`)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setColor(member.displayColor || 0x5865f2)
    .addFields(
      { name: "🏷️ Display Name", value: member.displayName, inline: true },
      { name: "🤖 Bot", value: user.bot ? "Yes" : "No", inline: true },
      { name: "📅 Account Created", value: createdAt },
      { name: "📥 Joined Server", value: joinedAt },
      { name: "🎭 Roles", value: roles.length > 1024 ? roles.slice(0, 1020) + "..." : roles },
    )
    .setFooter({ text: `User ID: ${user.id}` })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Show information about a user")
    .addUserOption((opt) => opt.setName("user").setDescription("The user (defaults to you)")),

  async execute(interaction) {
    const target = interaction.options.getMember("user") ?? interaction.member;
    await interaction.reply({ embeds: [buildEmbed(target)] });
  },

  async executePrefix(message) {
    const target = message.mentions.members.first() ?? message.member;
    await message.reply({ embeds: [buildEmbed(target)] });
  },
};
