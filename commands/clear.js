const { SlashCommandBuilder } = require("discord.js");
const { hasPermission } = require("../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Bulk delete messages in this channel (Admin/Staff only)")
    .addIntegerOption((opt) =>
      opt
        .setName("amount")
        .setDescription("Number of messages to delete (1–100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member))
      return interaction.reply({ content: "❌ You don't have permission to clear messages.", ephemeral: true });

    const amount = interaction.options.getInteger("amount");
    const deleted = await interaction.channel.bulkDelete(amount, true);
    await interaction.reply({ content: `✅ Deleted **${deleted.size}** message(s).`, ephemeral: true });
  },

  async executePrefix(message, args) {
    if (!hasPermission(message.member))
      return message.reply("❌ You don't have permission to clear messages.");

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100)
      return message.reply("❌ Please provide a number between 1 and 100. Usage: `$clear 10`");

    await message.delete().catch(() => {});
    const deleted = await message.channel.bulkDelete(amount, true);
    const reply = await message.channel.send(`✅ Deleted **${deleted.size}** message(s).`);
    setTimeout(() => reply.delete().catch(() => {}), 3000);
  },
};
