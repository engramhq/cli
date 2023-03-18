import util from "util"
import { exec } from "child_process"

const execPromise = util.promisify(exec);

export async function getRepositoryUrl() {
    const { stdout } = await execPromise("git remote get-url origin");
    return stdout;
}

export async function getCurrentBranch() {
    const { stdout } = await execPromise("git rev-parse --abbrev-ref HEAD");
    return stdout;
}
