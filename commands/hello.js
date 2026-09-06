const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("hello")
    .setDescription("Get a greeting from the bot"),

  async execute(interaction) {
    await interaction.reply(`Hello, ${interaction.user.username}! 👋`);
  },

  async executePrefix(message) {
    await message.reply(`Hello, ${message.author.username}! 👋`);
  },
};
