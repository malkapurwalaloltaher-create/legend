const { SlashCommandBuilder } = require("discord.js");

const INTERVAL_MS = 5000;
const DURATION_MS = 60000;

function getLatencyLine(latency, ws, tick) {
  const dots = ".".repeat((tick % 3) + 1).padEnd(3, " ");
  return `🏓 **Live Ping** ${dots}\n\n📶 Message latency: \`${latency}ms\`\n💓 WebSocket latency: \`${ws}ms\``;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Shows real-time ping, updating every 5 seconds"),

  async execute(interaction) {
    const latency = Date.now() - interaction.createdTimestamp;
    await interaction.reply(getLatencyLine(latency, interaction.client.ws.ping, 0));

    let tick = 1;
    const interval = setInterval(async () => {
      if (tick >= DURATION_MS / INTERVAL_MS) {
        clearInterval(interval);
        const final = Date.now() - interaction.createdTimestamp;
        await interaction.editReply(
          getLatencyLine(final, interaction.client.ws.ping, tick) + "\n\n🔴 Stopped updating."
        );
        return;
      }
      const updated = Date.now() - interaction.createdTimestamp;
      await interaction.editReply(getLatencyLine(updated, interaction.client.ws.ping, tick));
      tick++;
    }, INTERVAL_MS);
  },

  async executePrefix(message) {
    const latency = Date.now() - message.createdTimestamp;
    const sent = await message.reply(getLatencyLine(latency, message.client.ws.ping, 0));

    let tick = 1;
    const interval = setInterval(async () => {
      if (tick >= DURATION_MS / INTERVAL_MS) {
        clearInterval(interval);
        const final = Date.now() - message.createdTimestamp;
        await sent.edit(
          getLatencyLine(final, message.client.ws.ping, tick) + "\n\n🔴 Stopped updating."
        );
        return;
      }
      const updated = Date.now() - message.createdTimestamp;
      await sent.edit(getLatencyLine(updated, message.client.ws.ping, tick));
      tick++;
    }, INTERVAL_MS);
  },
};
