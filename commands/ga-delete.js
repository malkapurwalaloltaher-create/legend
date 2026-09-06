const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const { ensureAdmin } = require("../utils/adminOnly");
const GiveawayTemplate = require("../models/GiveawayTemplate");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gxdelete")
    .setDescription("Delete a saved giveaway template")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt => opt.setName("token").setDescription("Saved token").setRequired(true)),

  async execute(interaction) {
    if (!(await ensureAdmin(interaction))) return;

    const token = interaction.options.getString("token");

    const deleted = await GiveawayTemplate.findOneAndDelete({
      guildId: interaction.guild.id,
      token
    });

    if (!deleted) {
      return interaction.reply({
        content: "❌ No template found with that token.",
        ephemeral: true
      });
    }

    await interaction.reply({
      content: `✅ Giveaway template \`${token}\` deleted. That token is free again.`,
      ephemeral: true
    });
  }
};
