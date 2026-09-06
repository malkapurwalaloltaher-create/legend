const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const DashboardGiveawayRun = require("../models/DashboardGiveawayRun");
const giveawayV2Manager = require("../managers/giveawayV2Manager");

function parseDurationMinutes(raw) {
  const text = String(raw || "").trim().toLowerCase();
  const match = text.match(/^(\d+)(m|h|d)?$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2] || "m";
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (unit === "d") return amount * 1440;
  if (unit === "h") return amount * 60;
  return amount;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Create and manage Legendary giveaways")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Start a giveaway with Join/Leave buttons")
        .addStringOption((opt) => opt.setName("prize").setDescription("Prize name").setRequired(true))
        .addStringOption((opt) => opt.setName("duration").setDescription("Example: 30m, 2h, 1d").setRequired(true))
        .addIntegerOption((opt) => opt.setName("winners").setDescription("Number of winners").setMinValue(1).setMaxValue(25))
        .addStringOption((opt) => opt.setName("description").setDescription("Giveaway description"))
    )
    .addSubcommand((sub) =>
      sub
        .setName("end")
        .setDescription("End a giveaway by ID")
        .addStringOption((opt) => opt.setName("id").setDescription("Giveaway ID from the embed footer").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("List running giveaways")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "start") {
      const prize = interaction.options.getString("prize", true).slice(0, 120);
      const durationText = interaction.options.getString("duration", true);
      const durationMinutes = parseDurationMinutes(durationText);
      const winnersCount = interaction.options.getInteger("winners") || 1;
      const description = (interaction.options.getString("description") || "Click Join to enter!").slice(0, 500);

      if (!durationMinutes) {
        return interaction.reply({ content: "❌ Invalid duration. Use `30m`, `2h`, or `1d`.", ephemeral: true });
      }

      const run = await DashboardGiveawayRun.create({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        hostId: interaction.user.id,
        hostTag: interaction.user.tag || interaction.user.username,
        prize,
        description,
        winnersCount,
        endsAt: new Date(Date.now() + durationMinutes * 60 * 1000),
      });

      const sent = await interaction.channel.send({
        embeds: [giveawayV2Manager.buildGiveawayEmbed(run)],
        components: giveawayV2Manager.buildGiveawayButtons(run),
      });

      run.messageId = sent.id;
      await run.save();

      return interaction.reply({ content: `✅ Giveaway started! ID: \`${run._id}\``, ephemeral: true });
    }

    if (sub === "end") {
      const id = interaction.options.getString("id", true);
      const run = await DashboardGiveawayRun.findOne({ _id: id, guildId: interaction.guildId }).catch(() => null);
      if (!run) return interaction.reply({ content: "❌ Giveaway not found.", ephemeral: true });
      await giveawayV2Manager.endGiveaway(run, interaction.client);
      return interaction.reply({ content: "✅ Giveaway ended.", ephemeral: true });
    }

    if (sub === "list") {
      const runs = await DashboardGiveawayRun.find({ guildId: interaction.guildId, status: "running" }).sort({ endsAt: 1 }).limit(10);
      if (!runs.length) return interaction.reply({ content: "No running giveaways.", ephemeral: true });
      return interaction.reply({
        content: runs.map((run) => `🎉 **${run.prize}** — ID: \`${run._id}\` — Entries: ${run.entries.length}`).join("\n"),
        ephemeral: true,
      });
    }

    return null;
  },
};
