const { PermissionsBitField } = require("discord.js");
const GiveawayRun = require("../models/GiveawayRun");
const GuildConfig = require("../models/GuildConfig");
const { buildLiveEmbed } = require("../utils/embeds");
const { initializeRecoveryEngine } = require("../utils/runtime");

async function init(client) {
  await initializeRecoveryEngine(client);
}

async function handleButton(interaction) {
  const customId = String(interaction.customId || "");
  if (!customId.startsWith("join_")) return false;

  const runId = customId.split("_")[1];
  const run = await GiveawayRun.findById(runId).catch(() => null);

  if (!run) {
    await interaction.reply({ content: "❌ Giveaway not found.", ephemeral: true }).catch(() => null);
    return true;
  }

  if (run.guildId !== interaction.guildId) {
    await interaction.reply({ content: "❌ This giveaway belongs to another server.", ephemeral: true }).catch(() => null);
    return true;
  }

  if (run.status !== "running") {
    await interaction.reply({ content: "❌ This giveaway is not active anymore.", ephemeral: true }).catch(() => null);
    return true;
  }

  if (run.isPaused) {
    await interaction.reply({ content: "❌ This giveaway is paused right now.", ephemeral: true }).catch(() => null);
    return true;
  }

  if (run.joinedUserIds.includes(interaction.user.id)) {
    await interaction.reply({ content: "❌ You already joined this giveaway.", ephemeral: true }).catch(() => null);
    return true;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    await interaction.reply({ content: "❌ Could not verify your membership.", ephemeral: true }).catch(() => null);
    return true;
  }

  if (!run.staffParticipation) {
    const isStaff =
      member.permissions.has(PermissionsBitField.Flags.Administrator) ||
      member.permissions.has(PermissionsBitField.Flags.ManageGuild);

    if (isStaff) {
      if (!run.blockedUsers.includes(interaction.user.id)) {
        run.blockedUsers.push(interaction.user.id);
        await run.save();
      }

      await interaction.reply({
        content: "❌ Staff members are not allowed to participate in this giveaway.",
        ephemeral: true,
      }).catch(() => null);
      return true;
    }
  }

  if (run.requiredRoleId && !member.roles.cache.has(run.requiredRoleId)) {
    if (!run.blockedUsers.includes(interaction.user.id)) {
      run.blockedUsers.push(interaction.user.id);
      await run.save();
    }

    await interaction.reply({
      content: "❌ You do not have the required role for this giveaway.",
      ephemeral: true,
    }).catch(() => null);
    return true;
  }

  const minAgeDays = typeof run.minAccountAgeDays === "number" ? run.minAccountAgeDays : 3;
  if (minAgeDays > 0) {
    const accountAgeMs = Date.now() - interaction.user.createdTimestamp;
    const requiredMs = minAgeDays * 24 * 60 * 60 * 1000;

    if (accountAgeMs < requiredMs) {
      if (!run.blockedUsers.includes(interaction.user.id)) {
        run.blockedUsers.push(interaction.user.id);
        await run.save();
      }

      await interaction.reply({
        content: `❌ Your account must be at least ${minAgeDays} day(s) old to join this giveaway.`,
        ephemeral: true,
      }).catch(() => null);
      return true;
    }
  }

  const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
  let entriesToAdd = 1;

  if (guildConfig?.bonusEntryRoles?.length) {
    for (const config of guildConfig.bonusEntryRoles) {
      if (member.roles.cache.has(config.roleId)) {
        entriesToAdd = Math.max(entriesToAdd, Number(config.entries || 1));
      }
    }
  }

  run.joinedUserIds.push(interaction.user.id);

  for (let i = 0; i < entriesToAdd; i++) {
    run.participants.push(interaction.user.id);
  }

  await run.save();

  const channel = await interaction.client.channels.fetch(run.channelId).catch(() => null);
  if (channel && channel.isTextBased() && run.statusMessageId) {
    const statusMessage = await channel.messages.fetch(run.statusMessageId).catch(() => null);
    if (statusMessage) {
      await statusMessage.edit({
        embeds: [buildLiveEmbed(run)],
        components: statusMessage.components,
      }).catch(() => null);
    }
  }

  if (typeof run.participantDmMessage === "string" && run.participantDmMessage.trim()) {
    await interaction.user.send(run.participantDmMessage).catch(() => null);
  }

  await interaction.reply({
    content: `✅ You joined the giveaway! Your entry count for this giveaway is **${entriesToAdd}**.`,
    ephemeral: true,
  }).catch(() => null);

  return true;
}

module.exports = {
  init,
  handleButton,
};
