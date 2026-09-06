const { SlashCommandBuilder } = require("discord.js");
const { hasPermission } = require("../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription("Make the bot say something in this channel (Staff only)")
    .addStringOption((opt) =>
      opt.setName("message").setDescription("The message to say").setRequired(true)
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member))
      return interaction.reply({ content: "❌ You don't have permission to use this command.", ephemeral: true });

    const content = interaction.options.getString("message");
    await interaction.channel.send(content);
    await interaction.reply({ content: "✅ Done!", ephemeral: true });
  },

  async executePrefix(message, args) {
    if (!hasPermission(message.member))
      return message.reply("❌ You don't have permission to use this command.");

    const content = args.join(" ");
    if (!content) return message.reply("❌ Please provide a message. Usage: `$say Hello everyone!`");

    await message.delete().catch(() => {});
    await message.channel.send(content);
  },
};
