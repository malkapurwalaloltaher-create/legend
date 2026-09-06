const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const { ensureAdmin } = require("../utils/adminOnly");
const { parseClaimTime } = require("../utils/duration");
const GiveawayTemplate = require("../models/GiveawayTemplate");
const GiveawayRun = require("../models/GiveawayRun");
const GuildConfig = require("../models/GuildConfig");
const { buildLiveEmbed } = require("../utils/embeds");
const { scheduleGiveawayLifecycle, logToChannel } = require("../utils/runtime");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gxstart")
    .setDescription("Start a giveaway on your own message")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt => opt.setName("token").setDescription("Saved token").setRequired(true))
    .addStringOption(opt => opt.setName("message_id").setDescription("Your manual giveaway message ID").setRequired(true))
    .addStringOption(opt => opt.setName("ending_message_1").setDescription("Half-time warning. Use {time}").setRequired(false))
    .addStringOption(opt => opt.setName("ending_message_2").setDescription("Quarter-time warning. Use {time}").setRequired(false))
    .addStringOption(opt => opt.setName("winner_announcement").setDescription("Final winner message. Use {winner_mentions}").setRequired(false))
    .addStringOption(opt => opt.setName("claim_time").setDescription("Example: 1h, 1h30m, 2h, or - for forever").setRequired(false)),

  async execute(interaction, client) {
    if (!(await ensureAdmin(interaction))) return;

    const token = interaction.options.getString("token");
    const messageId = interaction.options.getString("message_id");
    const endingMessage1 = interaction.options.getString("ending_message_1") || "";
    const endingMessage2 = interaction.options.getString("ending_message_2") || "";
    const winnerAnnouncement = interaction.options.getString("winner_announcement") || "";
    const claimTimeInput = interaction.options.getString("claim_time") || "";

    let claimTimeoutMs;
    try {
      claimTimeoutMs = parseClaimTime(claimTimeInput);
    } catch (error) {
      return interaction.reply({
        content: `❌ ${error.message}`,
        ephemeral: true
      });
    }

    const template = await GiveawayTemplate.findOne({
      guildId: interaction.guild.id,
      token
    });

    if (!template) {
      return interaction.reply({
        content: "❌ No giveaway template found with that token.",
        ephemeral: true
      });
    }

    const alreadyRunning = await GiveawayRun.findOne({
      guildId: interaction.guild.id,
      templateToken: token,
      status: "running"
    });

    if (alreadyRunning) {
      return interaction.reply({
        content: "❌ A giveaway with this token is already running.",
        ephemeral: true
      });
    }

    const channel = await client.channels.fetch(template.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      return interaction.reply({
        content: "❌ Giveaway channel not found.",
        ephemeral: true
      });
    }

    const announcementMsg = await channel.messages.fetch(messageId).catch(() => null);
    if (!announcementMsg) {
      return interaction.reply({
        content: "❌ Could not find that message ID in the saved channel.",
        ephemeral: true
      });
    }

    const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });

    const run = await GiveawayRun.create({
      guildId: interaction.guild.id,
      templateToken: token,
      prize: template.prize,
      durationMs: template.durationMs,
      winnerCount: template.winnerCount,
      channelId: channel.id,
      messageId: announcementMsg.id,
      hostUserId: interaction.user.id,
      hostDisplay: template.hostDisplay || "GiveX System",
      winnerDmMessage: template.winnerDmMessage,
      participantDmMessage: template.participantDmMessage,
      requiredRoleId: template.requiredRoleId,
      minAccountAgeDays: template.minAccountAgeDays,
      staffParticipation: template.staffParticipation,
      customEndingMessage1: endingMessage1,
      customEndingMessage2: endingMessage2,
      customWinnerAnnouncement: winnerAnnouncement,
      logChannelId: guildConfig?.logChannelId || "",
      claimTimeoutMs,
      participants: [],
      joinedUserIds: [],
      blockedUsers: [],
      winnerIds: [],
      status: "running",
      startedAt: Date.now(),
      endsAt: Date.now() + template.durationMs
    });

    const statusMessage = await channel.send({
      embeds: [buildLiveEmbed(run)],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 3,
              custom_id: `join_${run._id}`,
              label: "🎉 Join Giveaway"
            }
          ]
        }
      ]
    });

    run.statusMessageId = statusMessage.id;
    await run.save();

    await logToChannel(
      client,
      run,
      `✅ Giveaway started by <@${interaction.user.id}> for **${run.prize}** with token \`${run.templateToken}\`. Claim time: ${claimTimeoutMs === -1 ? "No limit" : `${claimTimeInput || "12h default"}`}`
    );

    await interaction.reply({
      content: "✅ Giveaway started!",
      ephemeral: true
    });

    await scheduleGiveawayLifecycle(client, run._id);
  }
};
