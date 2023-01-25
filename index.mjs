#!/usr/bin/env node
import { parseArgs } from "node:util";
import fs from "fs";
import fsPromise from "fs/promises";
import axios from "axios";
import FormData from "form-data";
import tar from "tar";

async function triggerDeploy({ name, platform }) {
  const startTime = new Date().getTime();

  const tmpDeployFilename = `${name}.tar.gz`;

  await tar.create(
    {
      gzip: true,
      file: tmpDeployFilename,
      filter: (path) => {
        const excludedPaths = [
          ".git",
          ".gitignore",
          "node_modules",
          "package.json",
          "yarn.lock",
          "package-lock.json",
          tmpDeployFilename,
        ];
        return !excludedPaths.includes(path);
      },
    },
    ["./"]
  );

  const readStream = fs.createReadStream(tmpDeployFilename);
  const form = new FormData();
  form.append("tar", readStream);

  let nameToSend = name;

  // Default name to folder name if none provided
  if (!nameToSend) {
    const split = process.cwd().split("/");
    nameToSend = split[split.length - 1];
  }
  
  form.append("name", name);

  if (platform) {
    form.append("platform", platform)
  }

  // TODO: this should be a domain not hard coded IP...
  const deployHost = process.env.HOST || "138.197.173.217:4242";

  await axios.post(`http://${deployHost}/deploy/upload`, form, {
    headers: {
      ...form.getHeaders(),
    },
  });

  await fsPromise.unlink(tmpDeployFilename);

  const accountName = "adam";
  const endTime = new Date().getTime();
  const totalDurationMs = endTime - startTime;
  console.log(
    `Deployed to https://${name}-${accountName}.engramhq.xyz in ${totalDurationMs}ms`
  );
}

const args = [...process.argv];
args.splice(0, 2);
const { values, positionals } = parseArgs({
  args,
  options: {
    name: {
      type: "string",
      short: "n",
    },
    platform: {
      type: "string",
      short: "p",
    },
  },
  allowPositionals: true,
});

if (positionals[0] === "deploy") {
  triggerDeploy(values);
}
