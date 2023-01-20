#!/usr/bin/env node
import fs from "fs";

async function triggerDeploy() {
  const startTime = new Date().getTime();

  const packageJson = fs.readFileSync("package.json");
  const packageJsonContents = JSON.parse(packageJson);

  const { repository } = packageJsonContents.repository;

  // TODO: replace with proper domain
  const res = await fetch("http://138.197.173.217:4242/deploy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      repository
    })
  })

  const endTime = new Date().getTime();
  const deployTime = endTime - startTime;

  if (res.status === 200) {
    console.log(`Deployed in ${deployTime}ms`);
  }
}

if (process.argv.length >= 3 && process.argv[2] === "deploy") {
  triggerDeploy();
}
