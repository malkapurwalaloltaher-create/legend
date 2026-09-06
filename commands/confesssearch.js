const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require("discord.js");
const Confession = require("../models/Confession");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("confesssearch")
    .setDescription("Staff only: find who sent a confession or reply")
    .addStringOption((opt) =>
      opt
        .setName("message_id")
        .setDescription("The bot confession/reply message ID")
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
    }

    const messageId = interaction.options.getString("message_id");

    const found = await Confession.findOne({
      guildId: interaction.guildId,
      messageId,
    });

    if (!found) {
      return interaction.reply({
        content: "❌ No confession or reply found with that message ID.",
        ephemeral: true,
      });
    }

    const typeLabel = found.type === "reply" ? "Reply" : "Confession";

    const fields = [
      { name: "Type", value: typeLabel, inline: true },
      { name: "Message ID", value: found.messageId, inline: false },
      { name: "Sent By", value: `<@${found.userId}>`, inline: true },
      { name: "User ID", value: found.userId, inline: true },
      { name: "Username Saved", value: found.username, inline: false },
      { name: "Message Text", value: found.text.slice(0, 1000), inline: false },
    ];

    if (found.type === "confession") {
      fields.unshift({
        name: "Confession Number",
        value: `#${found.confessionNumber}`,
        inline: true,
      });
    }

    if (found.type === "reply") {
      fields.unshift({
        name: "Reply To",
        value: `Confession #${found.parentConfessionNumber}`,
        inline: true,
      });

      fields.push({
        name: "Parent Message ID",
        value: found.parentMessageId || "Unknown",
        inline: false,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("🔎 Confession Search Result")
      .setColor(0xff5c8a)
      .addFields(fields)
      .setTimestamp(found.createdAt);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },

  async executePrefix(message) {
    await message.reply("Use slash command: `/confesssearch message_id`");
  },
};
