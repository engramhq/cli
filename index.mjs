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
import { fileURLToPath } from "url";
import { exec } from "child_process";
import chokidar from "chokidar";
import http from "http";
import { getCurrentBranch, getRepositoryUrl } from "./GitUtils.mjs";

http.globalAgent = new http.Agent({ keepAlive: true });

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// TODO: this should be a domain not hard coded IP...
let baseUrl = process.env.BASE_URL || "https://engram.sh";

async function triggerPreview(values) {
  triggerDeploy({
    ...values, 
    preview: true
  });
}

async function triggerDeploy(values) {
  const config = await getConfig();
  if (!config?.token) {
    console.log("Please login with `eg login`");
    return;
  }
  
  const { token } = config;

  let {
    name,
    platform,
    path: pathToDeploy,
    build,
    watch,
    privacy,
    preview,
    source = 'local',
    dev,
    port,
    v1,
    repo,
    branch,
    init
  } = values || {};

  if(dev) {
    baseUrl = port ? `http://local.engram.sh:${port}` : 'http://local.engram.sh:8000'
  }
  else if (v1) {
    baseUrl = 'http://138.197.173.217:4242'
  }

  if (source !== 'local' && !repo) {
    try {
      repo = await getRepositoryUrl();

      if (!branch) {
        branch = await getCurrentBranch();
      }
    } catch(err) {
      // Not a repository, that's ok
    }
  }

  if (!repo) {
    const tmpDeployFilename = `${name}.tar.gz`;

    const bindedDeploy = deploy.bind(this, {
      name,
      platform,
      pathToDeploy,
      build,
      watch,
      token,
      tmpDeployFilename,
      privacy,
      preview
    });

    if (watch) {
      const watcher = chokidar.watch(pathToDeploy, {
        ignored: [tmpDeployFilename],
      });
      watcher.on("change", (filename) => {
        handleFileChanged({
          filename,
          tmpDeployFilename,
          name,
          token,
        });
      });
    }

    await bindedDeploy();
  } else {
    try {
      const response = await axios.post(
        `${baseUrl}/deploy/git`,
        {
          name,
          repo,
          branch,
          privacy,
          init,
          platform
        },
        {
          headers: {
            "x-access-token": token,
          },
          responseType: "stream",
        }
      );

      const stream = response.data;

      stream.on("data", (data) => {
        console.log(String(data));
      });

    } catch (err) {
      if (err.response?.data) {
        err.response?.data.on("data", (data) => {
          console.log(String(data));
        });
      } else {
        console.error(err);
      }
    }
  }
}

async function handleFileChanged({ filename, name, tmpDeployFilename, token}) {
  const startTime = new Date().getTime();

  await tar.create({
      gzip: true,
      file: tmpDeployFilename, //name of the tar file
    },
    [filename] //Relative path to file from project root
  );

  const readStream = fs.createReadStream(tmpDeployFilename);
  const form = new FormData();
  form.append("tar", readStream);
  form.append("name", name); 
  form.append('incremental', 'true');

  const getLengthAsync = promisify(form.getLength.bind(form));
  const contentLength = await getLengthAsync();
  // This is an ugly hack to deal with an Ubuntu 20 issue
  form.getLengthSync = null;

  try {
    await axios.post(`${baseUrl}/api/deployments`, form, {
      headers: {
        ...form.getHeaders(),
        "Content-Length": contentLength,
        "x-access-token": token,
      }
    });

    const endTime = new Date().getTime();
    console.log(`Updated in ${endTime - startTime}ms`);

  } catch (err) {
    if (err.response?.data) {
      console.log(String(err.response?.data));
    } else {
      console.error(err);
    }
  }

  await fs.remove(tmpDeployFilename);
}

async function deploy({
  build,
  name,
  pathToDeploy,
  platform,
  token,
  tmpDeployFilename,
  privacy,
  preview
}) {
  if (build) {
    await execAsync("npm run build");
  }

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

        for (const excludedPath of excludedPaths) {
          if (path.includes(excludedPath)) {
            return false;
          }
        }

        return true;
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

  if(preview) {
    form.append("previewEnabled", String(preview));
  }

  if (platform) {
    form.append("platform", platform);
  }

  form.append("privacy", privacy);

  const getLengthAsync = promisify(form.getLength.bind(form));
  const contentLength = await getLengthAsync();
  // This is an ugly hack to deal with an Ubuntu 20 issue
  form.getLengthSync = null;

  try {
    const response = await axios.post(
      `${baseUrl}/api/deployments`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          "Content-Length": contentLength,
          "x-access-token": token,
        },
        responseType: "stream",
      }
    );

    const stream = response.data;

    stream.on("data", (data) => {
      console.log(String(data));
    });

  } catch (err) {
    if (err.response?.data) {
      err.response?.data.on("data", (data) => {
        console.log(String(data));
      });
    } else {
      console.error(err);
    }
  }

  await fsPromise.unlink(tmpDeployFilename);
}

async function handleSignup(values) {

  isDev(values.dev);

  const username = await readline.question("Username: ");
  const email = await readline.question("Email: ");

  const password = await readline.question("Password: ", {
    hideEchoBack: true,
  });

  try {
    const res = await axios.post(`${baseUrl}/api/users/signup`, {
      username,
      email,
      password,
    });
    updateConfig(res.data);
    console.log(
      "Successfully created account. You can now deploy using 'eg deploy'"
    );
  } catch (err) {
    if (err.response?.data) {
      console.error(err.response?.data?.error);
    } else {
      console.error(err.message);
    }
  }
}

async function handleLogin(values) {
  
  isDev(values.dev);

  const username = await readline.question("Username: ");

  const password = await readline.question("Password: ", {
    hideEchoBack: true,
  });

  try {
    const res = await axios.post(`${baseUrl}/api/users/login`, {
      username,
      password,
    });
    updateConfig(res.data);
    console.log(`Successfully logged in as ${username}`);
  } catch (err) {
    if (err.response?.data) {
      console.error(err.response?.data?.error);
    } else {
      console.error(err.message);
    }
  }
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

async function whoAmI(values) {
  try {
      isDev(values.dev);
    
      const config = await getConfig();
      if (!config?.token) {
        console.log("Please login with `eg login`");
        return;
      }
    
      const { token } = config;
    
      const res = await axios.get(`${baseUrl}/api/users/me`, {
        headers: {
          "x-access-token": token,
        },
      });

      if(res.data.username) {
        console.log(res.data.username);
      }
      else {
        throw new Error('User not found')
      }

  } catch(err) {
    if (err.response?.data) {
      console.error(err.response?.data?.error);
    } else {
      console.error(err.message);
    }
  }
}

async function handleNewProject({ template, destination }) {
  const templatePath = path.join(__dirname, "templates", template);

  fs.copySync(templatePath, destination);

  console.log(`Template copied to ${destination}`);
}

function isDev(dev, port) {
  if(dev) {
    baseUrl = port ? `http://local.engram.sh:${port}` : 'http://local.engram.sh:8000'
  }
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
  .option("template", {
    alias: "t",
    type: "string",
    default: "html",
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
  .option("init", {
    type: "boolean",
    default: false
  })
  // .option("repo", {
  //   alias: "r",
  //   type: "string",
  //   description: "Repository URL to deploy",
  // })
  // .option("branch", {
  //   type: "string",
  //   description: "Branch to deploy",
  // })
  // .option("source", {
  //   type: "string",
  //   description: "Source to deploy from (local|git)"
  // })
  .option("v1", {
    type: "boolean",
    description: "Deploy to the old IP"
  })
  .option("dev", {
    type: "boolean",
    description: "Deploy to localhost (local.engram.sh)"
  })
  .option('port', {
    type: "string",
    description: "Port used by local.engram.sh (default 8000)"
  })
  .option("build", {
    alias: "b",
    type: "boolean",
    default: false,
    description: "Call npm run build before deploying",
  })
  .option("privacy", {
    type: "string",
    default: "private",
    description:
      "Deployments are private by default set to public to make publicly accessible",
  })
  .option("watch", {
    alias: "w",
    type: "boolean",
    default: false,
    description: "Watches for file changes and auto deploys on changes",
  })
  .command("signup", "sign up for engram cloud account", () => {}, handleSignup)
  .command(
    "login",
    "log in to your engram cloud account",
    () => {},
    handleLogin
  )
  .command("whoami", "returns current username", () => {}, whoAmI)
  .command("preview", "Similar to eg deploy but enables preview UI (Comments, pins, etc)", () => {}, triggerPreview)
  .parse();
