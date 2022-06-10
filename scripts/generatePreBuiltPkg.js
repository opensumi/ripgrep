//@ts-check
const fs = require("node:fs/promises");
const path = require("node:path");

const { downloadGithub } = require("./downloadGithub");
const PKG_DIR = "prebuilt";
const RG_VERSION = require("../package.json").rgVersion;
const prebuiltVersion = require("../package.json").prebuiltVersion;

async function main() {
  try {
    await fs.mkdir(PKG_DIR);
  } catch (error) {}

  const pkgJson = await fs.readFile(
    path.join(__dirname, "build.package.json"),
    "utf8"
  );

  const jsonContent = JSON.parse(pkgJson);
  jsonContent.version = prebuiltVersion;

  await fs.writeFile(
    path.join(PKG_DIR, "package.json"),
    JSON.stringify(jsonContent, null, 2)
  );

  const downloadTargetDir = path.join(PKG_DIR, "build");
  const cacheDownloadDir = path.join(PKG_DIR, "cache");
  await downloadGithub(RG_VERSION, downloadTargetDir, cacheDownloadDir);
}

main();
