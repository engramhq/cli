#!/usr/bin/env node
import * as readline from "node:readline/promises";
import { parseArgs } from "node:util";
import fs from "fs";
import fsPromise from "fs/promises";
import axios from "axios";
import path from "path";
import FormData from "form-data";
import tar from "tar";
import os from "os";
import { stdin as input, stdout as output } from "node:process";

// TODO: this should be a domain not hard coded IP...
const deployHost = process.env.HOST || "138.197.173.217:4242";

async function triggerDeploy(values) {
  const config = await getConfig();
  if (!config?.token) {
    console.log("Please login with `eg login`");
    return;
  }

  const { token, username } = config;

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

  try {
    await axios.post(`http://${deployHost}/deploy/upload`, form, {
      headers: {
        ...form.getHeaders(),
        "x-access-token": token,
      },
    });
    const endTime = new Date().getTime();
    const totalDurationMs = endTime - startTime;
    console.log(
      `Deployed to https://${name}-${username}.engramhq.xyz in ${totalDurationMs}ms`
    );
  } catch (err) {
    if (err.response?.data?.data?.error) {
      const message = err.response.data.data.error;
      console.error(message);
    }
  }

  await fsPromise.unlink(tmpDeployFilename);
}

async function handleSignup() {
  const rl = readline.createInterface({ input, output });

  const username = await rl.question("Username?");
  const email = await rl.question("Email?");

  // TODO: prevent password from displaying
  const password = await rl.question("Password?");

  rl.close();

  const res = await axios.post(`http://${deployHost}/signup`, {
    username,
    email,
    password,
  });
  updateConfig(res.data);
}

async function handleLogin() {
  const rl = readline.createInterface({ input, output });

  const username = await rl.question("Username?");

  // TODO: prevent password from displaying
  const password = await rl.question("Password?");

  rl.close();

  const res = await axios.post(`http://${deployHost}/login`, {
    username,
    password,
  });
  updateConfig(res.data);
}

const homeDir = os.homedir();
const engramConfigFolder = path.join(homeDir, ".engram");
const configJsonPath = path.join(engramConfigFolder, "config.json");

async function getConfig() {
  const jsonConfigString = await fsPromise.readFile(configJsonPath);
  return JSON.parse(jsonConfigString);
}

async function updateConfig(newConfig) {
  await fsPromise.mkdir(engramConfigFolder, {
    recursive: true,
  });

  await fsPromise.writeFile(configJsonPath, JSON.stringify(newConfig));
}

async function whoAmI() {
  const config = await getConfig();
  if (!config?.token) {
    console.log("Please login with `eg login`");
    return;
  }

  const { token } = config;

  const res = await axios.get(`http://${deployHost}/me`, {
    headers: {
      "x-access-token": token,
    },
  });
  console.log(res.data.data);
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
