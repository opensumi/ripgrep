// @ts-check
const path = require("path");
const fs = require("fs");
const os = require("os");
const https = require("https");
const util = require("util");
const url = require("url");
const URL = url.URL;
const child_process = require("child_process");
const proxy_from_env = require("proxy-from-env");

const downloadOpts = {
  headers: {
    "user-agent": "@opensumi/ripgrep",
  },
};

if (process.env.GITHUB_TOKEN) {
  downloadOpts.headers.authorization = `token ${process.env.GITHUB_TOKEN}`;
}

function get(_url, opts) {
  console.log(`GET ${_url}`);

  const proxy = proxy_from_env.getProxyForUrl(url.parse(_url));
  if (proxy !== "") {
    opts = {
      ...opts,
      agent: require("https-proxy-agent")(proxy),
    };
  }

  return new Promise((resolve, reject) => {
    let result = "";
    opts = {
      ...url.parse(_url),
      ...opts,
    };
    https.get(opts, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error("Request failed: " + response.statusCode));
      }

      response.on("data", (d) => {
        result += d.toString();
      });

      response.on("end", () => {
        resolve(result);
      });

      response.on("error", (e) => {
        reject(e);
      });
    });
  });
}

function isGithubUrl(_url) {
  return url.parse(_url).hostname === "api.github.com";
}

function download(_url, dest, opts) {
  const proxy = proxy_from_env.getProxyForUrl(url.parse(_url));
  if (proxy !== "") {
    opts = {
      ...opts,
      agent: require("https-proxy-agent")(proxy),
      proxy,
    };
  }

  if (opts.headers && opts.headers.authorization && !isGithubUrl(_url)) {
    delete opts.headers.authorization;
  }

  return new Promise((resolve, reject) => {
    console.log(`Download from _url: ${_url}`);
    console.log(`Download options: ${JSON.stringify(opts)}`);
    const outFile = fs.createWriteStream(dest);
    const mergedOpts = {
      ...url.parse(_url),
      ...opts,
    };
    https
      .get(mergedOpts, (response) => {
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
        await fs.promises.unlink(dest);
        reject(err);
      });
  });
}
const fsExists = util.promisify(fs.exists);
function untar(zipPath, destinationDir) {
  return new Promise((resolve, reject) => {
    const unzipProc = child_process.spawn(
      "tar",
      ["xvf", zipPath, "-C", destinationDir],
      { stdio: "inherit" }
    );
    unzipProc.on("error", (err) => {
      reject(err);
    });
    unzipProc.on("close", (code) => {
      console.log(`tar xvf exited with ${code}`);
      if (code !== 0) {
        reject(new Error(`tar xvf exited with ${code}`));
        return;
      }

      resolve();
    });
  });
}

async function unzipRipgrep(zipPath, destinationDir) {
  await untar(zipPath, destinationDir);

  const expectedName = path.join(destinationDir, "rg");
  if (await fsExists(expectedName)) {
    fs.copyFileSync(expectedName, expectedName + ".r3bin");
    await fs.promises.unlink(expectedName);
    return expectedName;
  }
  const expectedNameExe = expectedName + ".exe";
  if (await fsExists(expectedNameExe)) {
    fs.copyFileSync(expectedNameExe, expectedNameExe + ".r3bin");
    try {
      await fs.promises.unlink(expectedNameExe);
    } catch (e) {}
    return expectedNameExe;
  }

  throw new Error(
    `Expecting rg or rg.exe unzipped into ${destinationDir}, didn't find one.`
  );
}

async function downloadGithub(version, assetDownloadDir) {
  console.log(`Finding release for ${version}`);
  const API = `https://api.github.com/repos/microsoft/ripgrep-prebuilt/releases/tags/${version}`;
  fs.mkdirSync(assetDownloadDir, { recursive: true });

  const release = await get(API, downloadOpts);
  let jsonRelease;
  try {
    jsonRelease = JSON.parse(release);
  } catch (e) {
    throw new Error("Malformed API response: " + e.stack);
  }

  if (!jsonRelease.assets) {
    throw new Error("Bad API response: " + JSON.stringify(release));
  }

  for await (const asset of jsonRelease.assets) {
    const downloadFileDest = `${assetDownloadDir}/${asset.name}`;

    console.log(`Downloading from ${asset.url}`);
    console.log(`Downloading to ${downloadFileDest}`);

    downloadOpts.headers.accept = "application/octet-stream";
    try {
      if (await fsExists(downloadFileDest)) {
        console.log("File exists, Skipping download of " + asset.name);
      } else {
        await download(
          asset.browser_download_url,
          downloadFileDest,
          downloadOpts
        );
      }
    } catch (e) {
      console.log("Deleting invalid download cache");
      try {
        fs.promises.unlink(downloadFileDest);
      } catch (e) {}

      throw e;
    }
    console.log(`Unzipping to ${downloadFileDest}`);
    try {
      const dirname = asset.name.replace(".tar.gz", "").replace(".zip", "");
      const unzipPATH = path.join(assetDownloadDir, dirname);
      fs.mkdirSync(unzipPATH, { recursive: true });
      await unzipRipgrep(downloadFileDest, unzipPATH);
    } catch (e) {
      console.log("Deleting invalid download");

      try {
        await fs.promises.unlink(downloadFileDest);
      } catch (e) {}

      throw e;
    }
    try {
      await fs.promises.unlink(downloadFileDest);
    } catch (e) {}
  }
}

module.exports = {
  downloadGithub,
};
