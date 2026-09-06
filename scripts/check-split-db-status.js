/* eslint-disable no-console */
require("dotenv").config();

const { connectAllMongoDatabases, getDbStatus } = require("../database/connections");

async function main() {
  console.log("🔍 Legendary Bot Split DB Status Check");
  console.log("=====================================");

  connectAllMongoDatabases();

  await new Promise((resolve) => setTimeout(resolve, 3500));

  const status = getDbStatus();

  for (const [scope, info] of Object.entries(status)) {
    console.log(
      `${info.status === "connected" ? "✅" : "⚠️"} ${scope}: ${info.status} | ${info.name || "no-db-name"} | ${info.host || "no-host"}`
    );
  }

  console.log("=====================================");
  console.log("Done.");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Split DB status check failed:", err);
  process.exit(1);
});
