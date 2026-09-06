const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { parseDuration } = require("../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remind")
    .setDescription("Set a reminder — bot will DM you when time's up")
    .addStringOption((opt) =>
      opt.setName("time").setDescription("When to remind you e.g. 10m, 2h, 1d").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("message").setDescription("What to remind you about").setRequired(true)
    ),

  async execute(interaction) {
    const timeStr = interaction.options.getString("time");
    const reminderMsg = interaction.options.getString("message");
    const duration = parseDuration(timeStr);

    if (!duration)
      return interaction.reply({ content: "❌ Invalid time. Examples: `10m`, `2h`, `1d`", ephemeral: true });

    await interaction.reply({
      content: `✅ Got it! I'll DM you about **${reminderMsg}** in **${timeStr}**.`,
      ephemeral: true,
    });

    setTimeout(async () => {
      try {
        const embed = new EmbedBuilder()
          .setTitle("⏰ Reminder!")
          .setColor(0x00ff00)
          .setDescription(reminderMsg)
          .setTimestamp();
        await interaction.user.send({ embeds: [embed] });
      } catch {}
    }, duration);
  },

  async executePrefix(message, args) {
    const timeStr = args[0];
    if (!timeStr) return message.reply("❌ Usage: `$remind 10m Your reminder message`");

    const duration = parseDuration(timeStr);
    if (!duration) return message.reply("❌ Invalid time. Examples: `10m`, `2h`, `1d`");

    const reminderMsg = args.slice(1).join(" ");
    if (!reminderMsg)
      return message.reply("❌ Please provide a reminder message. Usage: `$remind 10m Meeting at 3pm`");

    await message.reply(`✅ Got it! I'll DM you about **${reminderMsg}** in **${timeStr}**.`);

    setTimeout(async () => {
      try {
        const embed = new EmbedBuilder()
          .setTitle("⏰ Reminder!")
          .setColor(0x00ff00)
          .setDescription(reminderMsg)
          .setTimestamp();
        await message.author.send({ embeds: [embed] });
      } catch {}
    }, duration);
  },
};
