const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gxhelp")
    .setDescription("Show GiveX help")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle("📖 GiveX Help")
      .setDescription("Main commands")
      .addFields(
        { name: "/gxsetlogchannel", value: "Set giveaway log channel" },
        { name: "/gxentryroles", value: "Set bonus entry roles using role:entries" },
        { name: "/gxcreate", value: "Create template" },
        { name: "/gxedit", value: "Edit template" },
        { name: "/gxview", value: "View template" },
        { name: "/gxlist", value: "List templates" },
        { name: "/gxstart", value: "Start giveaway on your message" },
        { name: "/gxrepeat", value: "Repeat giveaway on your message" },
        { name: "/gxdelete", value: "Delete template" },
        { name: "/gxend", value: "End running giveaway" },
        { name: "/gxeroll", value: "Reroll ended giveaway" },
        { name: "/gxpick", value: "Manually pick winner" },
        { name: "/gxpause", value: "Pause running giveaway" },
        { name: "/gxresume", value: "Resume paused giveaway" },
        { name: "/gxclaim", value: "Mark winner as claimed" }
      )
      .setFooter({
        text: "Supported placeholders: {time} {prize} {winners} {token} {winner_mentions}"
      });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};
