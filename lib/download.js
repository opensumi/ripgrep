// @ts-check
"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");
const https = require("https");
const util = require("util");

const packageVersion = require("../package.json").version;
const prebuiltVersion = require("../package.json").prebuiltVersion;
const tmpDir = path.join(
  os.tmpdir(),
  `@opensumi-ripgrep-cache-${packageVersion}`
);

const fsUnlink = util.promisify(fs.unlink);
const fsExists = util.promisify(fs.exists);
const fsMkdir = util.promisify(fs.mkdir);

const isWindows = os.platform() === "win32";

function download(url, dest, opts) {
  return new Promise((resolve, reject) => {
    console.log(`Download options: ${JSON.stringify(opts)}`);
    const outFile = fs.createWriteStream(dest);
    https
      .get(url, opts, (response) => {
        console.log("statusCode: " + response.statusCode);
        if (response.statusCode === 302) {
          console.log("Following redirect to: " + response.headers.location);
          return download(response.headers.location, dest, opts).then(
            resolve,
            reject
          );
        } else if (response.statusCode !== 200) {
          reject(new Error("Download failed with " + response.statusCode));
          return;
        }

        response.pipe(outFile);
        outFile.on("finish", () => {
          resolve();
        });
      })
      .on("error", async (err) => {
        await fsUnlink(dest);
        reject(err);
      });
  });
}

/**
 * @param {{ force: boolean; token: string; version: string; target: string; destDir: string }} opts
 * @param {string} assetName
 */
async function getAssetFromCDN(opts, assetName) {
  try {
    await fsMkdir(opts.destDir);
  } catch (error) {}

  // rg.r3bin -> rg
  const rgDownloadTargetPath = path.join(
    opts.destDir,
    isWindows ? "rg.exe" : "rg"
  );

  // We can just use the cached binary
  if (!opts.force && (await fsExists(rgDownloadTargetPath))) {
    console.log("rgDownloadTargetPath already exists: " + rgDownloadTargetPath);
    return rgDownloadTargetPath;
  }
  // https://registry.npmmirror.com/@opensumi/ripgrep-prebuilt/1.4.0/files/build/ripgrep-v13.0.0-4-aarch64-pc-windows-msvc/rg.exe.r3bin
  const asset = {
    url: `https://registry.npmmirror.com/@opensumi/ripgrep-prebuilt/${prebuiltVersion}/files/build/${assetName}`,
  };

  console.log(`Downloading from ${asset.url}`);
  console.log(`Downloading to ${rgDownloadTargetPath}`);

  try {
    await download(asset.url, rgDownloadTargetPath, {
      timeout: 60 * 3 * 1000,
    });
    if (!isWindows) {
      await util.promisify(fs.chmod)(rgDownloadTargetPath, "755");
    }
  } catch (e) {
    console.log("Deleting invalid download cache");
    try {
      await fsUnlink(rgDownloadTargetPath);
    } catch (error) {}
    throw e;
  }
}

module.exports = async (opts) => {
  if (!opts.version) {
    return Promise.reject(new Error("Missing version"));
  }

  if (!opts.target) {
    return Promise.reject(new Error("Missing target"));
  }

  const filename = isWindows ? "rg.exe" : "rg";

  // fake r3bin file, it is an executable file, it just has a fake extension.
  const assetName =
    ["ripgrep", opts.version, opts.target].join("-") + `/${filename}.r3bin`;

  if (!(await fsExists(tmpDir))) {
    await fsMkdir(tmpDir);
  }

  await getAssetFromCDN(opts, assetName);
};
