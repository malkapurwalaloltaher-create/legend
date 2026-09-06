const { SlashCommandBuilder, ChannelType } = require("discord.js");
const { hasPermission } = require("../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send an announcement to a channel (Admin/Staff only)")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel to send the announcement to")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("The announcement message")
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({
        content: "❌ You need to be an **Admin** or **Staff** member to use this command.",
        ephemeral: true,
      });
    }

    const channel = interaction.options.getChannel("channel");
    const content = interaction.options.getString("message");

    await channel.send(content);
    await interaction.reply({ content: `✅ Announcement sent to ${channel}!`, ephemeral: true });
  },

  async executePrefix(message) {
    if (!hasPermission(message.member)) {
      return message.reply("❌ You need to be an **Admin** or **Staff** member to use this command.");
    }

    const channel = message.mentions.channels.first();
    if (!channel) {
      return message.reply("❌ Please mention a channel. Usage: `$announce #channel Your message here`");
    }

    const channelMention = channel.toString();
    const content = message.content.slice(message.content.indexOf(channelMention) + channelMention.length).trimStart();

    if (!content) {
      return message.reply("❌ Please provide a message. Usage: `$announce #channel Your message here`");
    }

    await channel.send(content);
    await message.reply(`✅ Announcement sent to ${channel}!`);
  },
};
