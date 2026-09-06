const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("confess")
    .setDescription("Send an anonymous confession"),

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId("confess_modal")
      .setTitle("💌 Anonymous Confession");

    const input = new TextInputBuilder()
      .setCustomId("confess_text")
      .setLabel("Write your confession")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Type your confession here...")
      .setRequired(true)
      .setMaxLength(1500);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    await interaction.showModal(modal);
  },

  async executePrefix(message) {
    await message.reply("Use slash command: `/confess`");
  },
};
