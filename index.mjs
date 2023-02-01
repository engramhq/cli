#!/usr/bin/env node
import readline from "readline-sync";
import { promisify } from "util";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import fs from "fs-extra";
import fsPromise from "fs/promises";
import axios from "axios";
import path from "path";
import FormData from "form-data";
import tar from "tar";
import os from "os";
import open from "open";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// TODO: this should be a domain not hard coded IP...
const deployHost = process.env.HOST || "138.197.173.217:4242";

async function triggerDeploy(values) {
  const config = await getConfig();
  if (!config?.token) {
    console.log("Please login with `eg login`");
    return;
  }

  const { token } = config;

  const { name, platform, path: pathToDeploy, preview } = values || {};
  const startTime = new Date().getTime();

  const tmpDeployFilename = `${name}.tar.gz`;

  await tar.create(
    {
      gzip: true,
      file: tmpDeployFilename,
      cwd: pathToDeploy,
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
    ['./']
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

  const getLengthAsync = promisify(form.getLength.bind(form));
  const contentLength = await getLengthAsync();
  // This is an ugly hack to deal with an Ubuntu 20 issue
  form.getLengthSync = null;

  try {
    const res = await axios.post(`http://${deployHost}/deploy/upload`, form, {
      headers: {
        ...form.getHeaders(),
        "Content-Length": contentLength,
        "x-access-token": token,
      },
    });
    const endTime = new Date().getTime();
    const totalDurationMs = endTime - startTime;
    console.log(`Deployed to ${res.data.data.url} in ${totalDurationMs}ms`);

    if (preview) {
      open(res.data.data.url);
    }
  } catch (err) {
    if (err.response?.data?.data?.error) {
      const message = err.response.data.data.error;
      console.error(message);
    }
  }

  await fsPromise.unlink(tmpDeployFilename);
}

async function handleSignup() {
  const username = await readline.question("Username: ");
  const email = await readline.question("Email: ");

  const password = await readline.question("Password: ", {
    hideEchoBack: true
  });

  const res = await axios.post(`http://${deployHost}/signup`, {
    username,
    email,
    password,
  });
  updateConfig(res.data);

  console.log("Successfully created account. You can now deploy using 'eg deploy'");
}

async function handleLogin() {
  const username = await readline.question("Username: ");

  const password = await readline.question("Password: ", {
    hideEchoBack: true
  });

  const res = await axios.post(`http://${deployHost}/login`, {
    username,
    password,
  });
  updateConfig(res.data);

  console.log(`Successfully logged in as ${username}`);
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

async function handleNewProject({ template, destination }) {
  const templatePath = path.join(__dirname, 'templates', template);

  fs.copySync(templatePath, destination);

  console.log(`Template copied to ${destination}`);
}

yargs(hideBin(process.argv))
  .command(
    "new [destination]",
    "creates a new project",
    (yargs) => {
      return yargs.positional("path", {
        describe: "name of project (used in final URL)",
        default: "./",
      });
    },
    handleNewProject
  )
  .option('template', {
    alias: 't',
    type: 'string',
    default: 'html'
  })
  .command(
    "deploy [path]",
    "deploy the project to engram cloud",
    (yargs) => {
      return yargs.positional("path", {
        describe: "name of project (used in final URL)",
        default: "./",
      });
    },
    triggerDeploy
  )
  .option("name", {
    alias: "n",
    type: "string",
    description:
      "Updates the subdomain prefix https://${name}-${username}.cloud.engramhq.xyz",
    default: "preview",
  })
  .option("platform", {
    alias: "p",
    type: "string",
    description: "Platform to deploy (static|docker)",
  })
  .option("preview", {
    type: "boolean",
    default: true
  })
  .command("signup", "sign up for engram cloud account", () => {}, handleSignup)
  .command(
    "login",
    "log in to your engram cloud account",
    () => {},
    handleLogin
  )
  .command("whoami", "returns current username", () => {}, whoAmI)
  .parse();
