#!/usr/bin/env node
import * as readline from "node:readline/promises";
import { parseArgs } from "node:util";
import fs from "fs";
import fsPromise from "fs/promises";
import axios from "axios";
import FormData from "form-data";
import tar from "tar";
import { stdin as input, stdout as output } from "node:process";

// TODO: this should be a domain not hard coded IP...
const deployHost = process.env.HOST || "138.197.173.217:4242";

async function triggerDeploy(values) {
  const { name, platform } = values || {};
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
    form.append("platform", platform);
  }

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

async function handleSignup() {
  const rl = readline.createInterface({ input, output });

  const username = await rl.question("Username?");
  const email = await rl.question("Email?");
  const password = await rl.question("Password?");

  rl.close();

  const res = await axios.post(`http://${deployHost}/signup`, {
    username,
    email,
    password,
  });
  console.log(res.data.token);
}

async function handleLogin() {
  const rl = readline.createInterface({ input, output });

  const username = await rl.question("Username?");
  const email = await rl.question("Email?");
  const password = await rl.question("Password?");

  rl.close();

  const res = await axios.post(`http://${deployHost}/login`, {
    username,
    email,
    password,
  });
  console.log(res.data.token);
}

async function whoAmI() {
  const res = await axios.get(`http://${deployHost}/me`, {
    headers: {
      // TODO: Read this from ~/.engram/token
      "X-Access-Token": ""
    }
  });
  console.log(res.data);
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
} else if (positionals[0] === "signup") {
  handleSignup(values);
} else if (positionals[0] === "login") {
  handleLogin(values);
} else if (positionals[0] === "whoami") {
  whoAmI(values);
}
