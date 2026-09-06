const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const { ensureAdmin } = require("../utils/adminOnly");
const GiveawayRun = require("../models/GiveawayRun");
const { logToChannel } = require("../utils/runtime");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gxeroll")
    .setDescription("Reroll a completed giveaway")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt => opt.setName("message_id").setDescription("Announcement message ID").setRequired(true)),

  async execute(interaction, client) {
    if (!(await ensureAdmin(interaction))) return;

    const messageId = interaction.options.getString("message_id");

    const run = await GiveawayRun.findOne({
      guildId: interaction.guild.id,
      messageId,
      status: "ended"
    });

    if (!run) {
      return interaction.reply({
        content: "❌ No ended giveaway found with that message ID.",
        ephemeral: true
      });
    }

    const possible = run.participants.filter(id => !run.winnerIds.includes(id));
    if (!possible.length) {
      return interaction.reply({
        content: "❌ No participants left to reroll.",
        ephemeral: true
      });
    }

    const chosenId = possible[Math.floor(Math.random() * possible.length)];
    const chosenUser = await client.users.fetch(chosenId).catch(() => null);

    if (!chosenUser) {
      return interaction.reply({
        content: "❌ Could not fetch the rerolled user.",
        ephemeral: true
      });
    }

    run.winnerIds.push(chosenId);
    await run.save();

    const channel = await client.channels.fetch(run.channelId).catch(() => null);
    if (channel && channel.isTextBased()) {
      await channel.send(`🔄 **Rerolled Winner:** <@${chosenId}>`).catch(() => null);
    }

    await chosenUser.send(run.winnerDmMessage).catch(() => null);
    await logToChannel(client, run, `🔄 Rerolled winner for **${run.prize}**: <@${chosenId}>`);

    await interaction.reply({
      content: "✅ Rerolled successfully.",
      ephemeral: true
    });
  }
};
