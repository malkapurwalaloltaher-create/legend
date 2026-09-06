const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function buildEmbed(options, choice) {
  return new EmbedBuilder()
    .setTitle("🎯 I Choose...")
    .setColor(0x00bcd4)
    .setDescription(
      `From: ${options.map((o) => `\`${o}\``).join(", ")}\n\n**🎉 ${choice}**`
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("choose")
    .setDescription("Let the bot pick one of your options")
    .addStringOption((opt) =>
      opt
        .setName("options")
        .setDescription("Options separated by commas — e.g. Pizza, Burger, Sushi")
        .setRequired(true)
    ),

  async execute(interaction) {
    const options = interaction.options.getString("options")
      .split(",").map((o) => o.trim()).filter(Boolean);
    if (options.length < 2)
      return interaction.reply({ content: "❌ Provide at least 2 options separated by commas.", ephemeral: true });
    await interaction.reply({ embeds: [buildEmbed(options, options[Math.floor(Math.random() * options.length)])] });
  },

  async executePrefix(message, args) {
    const options = args.join(" ").split(",").map((o) => o.trim()).filter(Boolean);
    if (options.length < 2)
      return message.reply("❌ Provide at least 2 options separated by commas. Usage: `$choose Pizza, Burger, Sushi`");
    await message.reply({ embeds: [buildEmbed(options, options[Math.floor(Math.random() * options.length)])] });
  },
};
