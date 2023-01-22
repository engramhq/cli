#!/usr/bin/env node
import fs from "fs";
import fsPromise from "fs/promises";
import axios from "axios";
import FormData from "form-data";
import tar from "tar";

async function triggerDeploy() {
  const tmpDeployFilename = "deploy.tar.gz";

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

  const readStream = fs.createReadStream("deploy.tar.gz");
  const form = new FormData();
  form.append("tar", readStream);

  const split = process.cwd().split("/");
  const defaultProjectName = split[split.length - 1]
  form.append("project", defaultProjectName);

  const deployHost = process.env.HOST || "138.197.173.217:4242";

  await axios.post(`http://${deployHost}/deploy/upload`, form, {
    headers: {
      ...form.getHeaders(),
    },
  });

  await fsPromise.unlink(tmpDeployFilename);
}

// TODO: Bring back when supporting node deployments
// async function triggerDeploy() {
//   const startTime = new Date().getTime();

//   const packageJson = fs.readFileSync("package.json");
//   const packageJsonContents = JSON.parse(packageJson);

//   const { repository } = packageJsonContents.repository;

//   // TODO: replace with proper domain
//   const res = await fetch("http://138.197.173.217:4242/deploy", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json"
//     },
//     body: JSON.stringify({
//       repository
//     })
//   })

//   const endTime = new Date().getTime();
//   const deployTime = endTime - startTime;

//   if (res.status === 200) {
//     console.log(`Deployed in ${deployTime}ms`);
//   }
// }

if (process.argv.length >= 3 && process.argv[2] === "deploy") {
  triggerDeploy();
}
