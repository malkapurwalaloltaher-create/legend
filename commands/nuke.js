const { SlashCommandBuilder } = require("discord.js");
const { requireStaffInteraction, requireStaffMessage, createCase, makeBasicEmbed } = require("../utils/moderationHelpers");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("nuke")
    .setDescription("Safely wipe the last 100 messages in this channel"),

  async execute(interaction) {
    if (!requireStaffInteraction(interaction)) return;
    await interaction.deferReply({ ephemeral: true });
    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    const deleted = await interaction.channel.bulkDelete(messages, true);
    const c = await createCase(interaction.guild, {
      action: "NUKE",
      targetId: interaction.channel.id,
      targetTag: `#${interaction.channel.name}`,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      reason: `Safely wiped ${deleted.size} recent messages`,
    });
    return interaction.editReply({ embeds: [makeBasicEmbed("💥 Channel Nuked Safely", `Deleted **${deleted.size}** recent messages. Case #${c.caseId}`, 0xef4444)] });
  },

  async executePrefix(message) {
    if (!requireStaffMessage(message)) return;
    const messages = await message.channel.messages.fetch({ limit: 100 });
    const deleted = await message.channel.bulkDelete(messages, true);
    const c = await createCase(message.guild, {
      action: "NUKE",
      targetId: message.channel.id,
      targetTag: `#${message.channel.name}`,
      moderatorId: message.author.id,
      moderatorTag: message.author.tag,
      reason: `Safely wiped ${deleted.size} recent messages`,
    });
    return message.channel.send({ embeds: [makeBasicEmbed("💥 Channel Nuked Safely", `Deleted **${deleted.size}** recent messages. Case #${c.caseId}`, 0xef4444)] });
  },
};
