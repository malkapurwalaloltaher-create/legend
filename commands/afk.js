const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const AfkStatus = require("../models/AfkStatus");

function cleanReason(value) {
  return String(value || "AFK").trim().slice(0, 180) || "AFK";
}

async function setAfk(guildId, user, reason) {
  return AfkStatus.findOneAndUpdate(
    { guildId, userId: user.id },
    {
      $set: {
        guildId,
        userId: user.id,
        username: user.tag || user.username || "",
        reason: cleanReason(reason),
        createdAt: new Date(),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function removeAfk(guildId, userId) {
  return AfkStatus.deleteOne({ guildId, userId });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("afk")
    .setDescription("Set or remove your AFK status")
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Why are you AFK? Use off/remove/stop to remove AFK.")
        .setRequired(false)
    ),

  aliases: ["away"],
  description: "Set AFK status. Use $afk off to remove it.",

  async execute(interaction) {
    const reason = cleanReason(interaction.options.getString("reason") || "AFK");

    if (["off", "remove", "stop", "back"].includes(reason.toLowerCase())) {
      await removeAfk(interaction.guildId, interaction.user.id);
      return interaction.reply({ content: "✅ Your AFK status has been removed.", ephemeral: true });
    }

    await setAfk(interaction.guildId, interaction.user, reason);

    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle("💤 AFK Enabled")
      .setDescription(`${interaction.user} is now AFK.\n**Reason:** ${reason}`)
      .setFooter({ text: "I will tell people when they mention you." })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args) {
    const reason = cleanReason(args.join(" ") || "AFK");

    if (["off", "remove", "stop", "back"].includes(reason.toLowerCase())) {
      await removeAfk(message.guild.id, message.author.id);
      return message.reply("✅ Your AFK status has been removed.");
    }

    await setAfk(message.guild.id, message.author, reason);

    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle("💤 AFK Enabled")
      .setDescription(`${message.author} is now AFK.\n**Reason:** ${reason}`)
      .setFooter({ text: "I will tell people when they mention you." })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
