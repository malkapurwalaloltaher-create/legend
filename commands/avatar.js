const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Show a user's avatar")
    .addUserOption((opt) => opt.setName("user").setDescription("The user (defaults to you)")),

  async execute(interaction) {
    const target = interaction.options.getUser("user") ?? interaction.user;
    const avatarUrl = target.displayAvatarURL({ size: 512, extension: "png" });
    const embed = new EmbedBuilder()
      .setTitle(`🖼 ${target.username}'s Avatar`)
      .setColor(0x5865f2)
      .setImage(avatarUrl)
      .setDescription(`[Open full size](${avatarUrl})`);
    await interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message) {
    const target = message.mentions.users.first() ?? message.author;
    const avatarUrl = target.displayAvatarURL({ size: 512, extension: "png" });
    const embed = new EmbedBuilder()
      .setTitle(`🖼 ${target.username}'s Avatar`)
      .setColor(0x5865f2)
      .setImage(avatarUrl)
      .setDescription(`[Open full size](${avatarUrl})`);
    await message.reply({ embeds: [embed] });
  },
};
