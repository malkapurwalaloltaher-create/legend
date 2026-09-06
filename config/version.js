const fs = require("fs");
const path = require("path");

function readPackageVersion() {
  try {
    const packagePath = path.join(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    return pkg.version ? `v${pkg.version}` : "v21.17.9";
  } catch {
    return "v21.17.9";
  }
}

module.exports = {
  version: readPackageVersion(),
  buildName: "Legend Hub Bot",
  codename: "Final Dashboard Query Fix",
  updatedAt: "2026-06-27",
};
