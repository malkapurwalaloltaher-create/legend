const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const CITIES = [
  // UAE
  "Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah",
  "Umm Al Quwain", "Al Ain", "Khor Fakkan", "Dibba Al Hisn", "Al Dhaid",
  "Madinat Zayed", "Ruwais", "Hatta",
  // Middle East
  "Doha", "Kuwait City", "Riyadh", "Jeddah", "Mecca", "Medina", "Muscat",
  "Manama", "Sana", "Baghdad", "Tehran", "Amman", "Jerusalem", "Tel Aviv",
  "Beirut", "Damascus", "Nicosia",
  // Europe
  "London", "Paris", "Berlin", "Madrid", "Rome", "Amsterdam", "Vienna",
  "Prague", "Budapest", "Warsaw", "Stockholm", "Copenhagen", "Oslo",
  "Helsinki", "Lisbon", "Athens", "Brussels", "Zurich", "Geneva", "Munich",
  "Frankfurt", "Hamburg", "Barcelona", "Milan", "Naples", "Manchester",
  "Dublin", "Edinburgh", "Lyon", "Marseille", "Rotterdam", "Cologne",
  "Stuttgart", "Dresden", "Krakow", "Bratislava", "Ljubljana", "Zagreb",
  "Belgrade", "Sarajevo", "Sofia", "Bucharest", "Kiev", "Minsk",
  "Riga", "Tallinn", "Vilnius", "Reykjavik",
  // North America
  "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
  "San Antonio", "Dallas", "San Diego", "San Francisco", "Seattle", "Miami",
  "Boston", "Atlanta", "Minneapolis", "Denver", "Detroit", "Portland",
  "Las Vegas", "Austin", "Nashville", "Memphis", "Washington DC",
  "Indianapolis", "Columbus", "Charlotte", "Honolulu", "Anchorage",
  "Toronto", "Vancouver", "Montreal", "Ottawa", "Calgary", "Edmonton",
  "Mexico City", "Guadalajara", "Monterrey", "Havana",
  // South America
  "Buenos Aires", "São Paulo", "Rio de Janeiro", "Lima", "Bogota",
  "Santiago", "Caracas", "Quito", "Montevideo", "Brasilia",
  // Asia
  "Tokyo", "Seoul", "Beijing", "Shanghai", "Singapore", "Hong Kong",
  "Bangkok", "Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata",
  "Dhaka", "Karachi", "Islamabad", "Lahore", "Kathmandu", "Colombo",
  "Yangon", "Phnom Penh", "Kuala Lumpur", "Jakarta", "Manila", "Taipei",
  "Ulaanbaatar", "Tashkent", "Astana", "Baku", "Tbilisi", "Yerevan",
  "Bishkek", "Dushanbe", "Ashgabat", "Kabul", "Ho Chi Minh City",
  "Hanoi", "Osaka", "Kyoto", "Ankara", "Istanbul", "Izmir",
  // Africa
  "Lagos", "Nairobi", "Johannesburg", "Cape Town", "Casablanca", "Cairo",
  "Addis Ababa", "Accra", "Dar es Salaam", "Kinshasa", "Kampala",
  "Khartoum", "Algiers", "Tunis", "Tripoli", "Rabat", "Abidjan",
  "Dakar", "Luanda", "Harare",
  // Russia
  "Moscow", "Saint Petersburg", "Novosibirsk", "Yekaterinburg",
  // Oceania
  "Sydney", "Melbourne", "Brisbane", "Perth", "Auckland", "Wellington",
  "Christchurch", "Adelaide", "Canberra",
];

const CONDITION_EMOJI = {
  sunny: "☀️", clear: "🌙", cloud: "☁️", overcast: "☁️",
  rain: "🌧️", drizzle: "🌦️", snow: "❄️", sleet: "🌨️",
  thunder: "⛈️", storm: "🌩️", fog: "🌫️", mist: "🌫️",
  haze: "🌫️", blizzard: "🌨️", wind: "💨",
};

function getConditionEmoji(desc) {
  const lower = desc.toLowerCase();
  for (const [key, emoji] of Object.entries(CONDITION_EMOJI)) {
    if (lower.includes(key)) return emoji;
  }
  return "🌤️";
}

async function getWeather(city) {
  const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
  if (!res.ok) throw new Error("City not found");
  const data = await res.json();
  if (!data.current_condition || !data.current_condition[0]) throw new Error("No data");
  return data;
}

function buildEmbed(data) {
  const c = data.current_condition[0];
  const area = data.nearest_area[0];
  const location = `${area.areaName[0].value}, ${area.country[0].value}`;
  const desc = c.weatherDesc[0].value;
  const emoji = getConditionEmoji(desc);

  return new EmbedBuilder()
    .setTitle(`${emoji} Weather in ${location}`)
    .setColor(0x87ceeb)
    .addFields(
      { name: "🌡️ Temperature", value: `${c.temp_C}°C  /  ${c.temp_F}°F`, inline: true },
      { name: "🤔 Feels Like", value: `${c.FeelsLikeC}°C  /  ${c.FeelsLikeF}°F`, inline: true },
      { name: `${emoji} Condition`, value: desc, inline: true },
      { name: "💧 Humidity", value: `${c.humidity}%`, inline: true },
      { name: "💨 Wind Speed", value: `${c.windspeedKmph} km/h`, inline: true },
      { name: "🔆 UV Index", value: c.uvIndex, inline: true },
      { name: "👁️ Visibility", value: `${c.visibility} km`, inline: true },
      { name: "☁️ Cloud Cover", value: `${c.cloudcover}%`, inline: true },
    )
    .setFooter({ text: "Live weather data from wttr.in" })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("weather")
    .setDescription("Get real-time weather for a city")
    .addStringOption((opt) =>
      opt
        .setName("city")
        .setDescription("Type a city name")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const matches = focused
      ? CITIES.filter((c) => c.toLowerCase().startsWith(focused))
      : CITIES.slice(0, 25);
    await interaction.respond(matches.slice(0, 25).map((c) => ({ name: c, value: c })));
  },

  async execute(interaction) {
    await interaction.deferReply();
    const city = interaction.options.getString("city");
    try {
      const data = await getWeather(city);
      await interaction.editReply({ embeds: [buildEmbed(data)] });
    } catch {
      await interaction.editReply("❌ Couldn't get weather for that city. Please try another.");
    }
  },

  async executePrefix(message, args) {
    if (!args.length) return message.reply("❌ Please provide a city. Usage: `$weather Dubai`");
    const city = args.join(" ");
    const reply = await message.reply("🔍 Fetching weather...");
    try {
      const data = await getWeather(city);
      await reply.edit({ content: "", embeds: [buildEmbed(data)] });
    } catch {
      await reply.edit("❌ Couldn't get weather for that city. Please try another.");
    }
  },
};
