const { SlashCommandBuilder } = require("discord.js");
const { hasPermission } = require("../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dm")
    .setDescription("Send a DM to a user (Admin/Staff only)")
    .addUserOption((opt) => opt.setName("user").setDescription("The user to DM").setRequired(true))
    .addStringOption((opt) =>
      opt.setName("message").setDescription("The message to send").setRequired(true)
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member))
      return interaction.reply({ content: "❌ You don't have permission to use this command.", ephemeral: true });

    const target = interaction.options.getUser("user");
    const content = interaction.options.getString("message");

    try {
      await target.send(content);
      await interaction.reply({ content: `✅ DM sent to **${target.tag}**!`, ephemeral: true });
    } catch {
      await interaction.reply({
        content: "❌ Couldn't send a DM. They may have DMs disabled.",
        ephemeral: true,
      });
    }
  },

  async executePrefix(message) {
    if (!hasPermission(message.member))
      return message.reply("❌ You don't have permission to use this command.");

    const target = message.mentions.users.first();
    if (!target) return message.reply("❌ Please mention a user. Usage: `$dm @user Your message`");

    const mention = target.toString();
    const content = message.content.slice(message.content.indexOf(mention) + mention.length).trim();

    if (!content) return message.reply("❌ Please provide a message. Usage: `$dm @user Your message`");

    try {
      await target.send(content);
      await message.reply(`✅ DM sent to **${target.tag}**!`);
    } catch {
      await message.reply("❌ Couldn't send a DM. They may have DMs disabled.");
    }
  },
};
