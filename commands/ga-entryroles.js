const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const { ensureAdmin } = require("../utils/adminOnly");
const GuildConfig = require("../models/GuildConfig");

function parseConfig(input) {
  const parts = input.split(",").map(p => p.trim()).filter(Boolean);
  const results = [];

  for (const part of parts) {
    const match = part.match(/(<@&(\d+)>|(\d+)):(\d+)/);
    if (!match) {
      throw new Error(`Invalid format: ${part}`);
    }

    const roleId = match[2] || match[3];
    const entries = Number(match[4]);

    if (!roleId || !entries || entries < 1) {
      throw new Error(`Invalid entries: ${part}`);
    }

    results.push({ roleId, entries });
  }

  return results;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gxentryroles")
    .setDescription("Set bonus entry roles. Example: <@&123>:2, <@&456>:3")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt =>
      opt
        .setName("config")
        .setDescription("Example: <@&123>:2, <@&456>:3")
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!(await ensureAdmin(interaction))) return;

    const configInput = interaction.options.getString("config");

    let parsed;
    try {
      parsed = parseConfig(configInput);
    } catch (error) {
      return interaction.reply({
        content: `❌ ${error.message}`,
        ephemeral: true
      });
    }

    await GuildConfig.findOneAndUpdate(
      { guildId: interaction.guild.id },
      { guildId: interaction.guild.id, bonusEntryRoles: parsed },
      { upsert: true, new: true }
    );

    const summary = parsed
      .map(item => `<@&${item.roleId}> → ${item.entries} entries`)
      .join("\n");

    await interaction.reply({
      content: `✅ Bonus entry roles saved:\n${summary}`,
      ephemeral: true
    });
  }
};
