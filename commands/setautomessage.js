const {
  SlashCommandBuilder,
  PermissionsBitField,
  ChannelType,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const autoMessageManager = require("../managers/autoMessageManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setautomessage")
    .setDescription("Set a message to auto-send every 12 hours")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Channel to send the message in")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
    }

    const channel = interaction.options.getChannel("channel");

    const modal = new ModalBuilder()
      .setCustomId(`auto_message_modal_${channel.id}`)
      .setTitle("Set Auto Message");

    const input = new TextInputBuilder()
      .setCustomId("auto_message_text")
      .setLabel("Message (sent every 12 hours)")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(2000)
      .setPlaceholder("Type the exact message here. Blank lines will be kept.");

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    await interaction.showModal(modal);
  },

  async handleModalSubmit(interaction, channelId) {
    const message = interaction.fields.getTextInputValue("auto_message_text");
    autoMessageManager.setAutoMessage(interaction.guildId, channelId, message);

    await interaction.reply({
      content: `✅ Auto message saved for <#${channelId}>. It will send every 12 hours exactly as you typed it.`,
      ephemeral: true,
    });
  },

  async executePrefix(message) {
    await message.reply("Use the slash command: /setautomessage");
  },
};
