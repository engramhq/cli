import util from "util"
import { exec } from "child_process"

const execPromise = util.promisify(exec);

export async function getRepositoryUrl() {
    const { stdout } = await execPromise("git remote get-url origin");
    return convertSSHRepoToHTTPS(stdout.trim());
}

export function convertSSHRepoToHTTPS(repo) {
    if (repo && repo.includes("git@github.com:")) {
        return `https://github.com/${repo.replace("git@github.com:", "")}`;
    }
    return repo;
}

export async function getCurrentBranch() {
    const { stdout } = await execPromise("git rev-parse --abbrev-ref HEAD");
    return stdout.trim();
}