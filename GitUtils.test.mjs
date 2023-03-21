import { convertSSHRepoToHTTPS } from "./GitUtils.mjs";

test("returns null if input null", () => {
  expect(convertSSHRepoToHTTPS(null)).toBe(null);
});

test("converts ssh url to https", () => {
  expect(convertSSHRepoToHTTPS("git@github.com:engramhq/cli.git")).toBe(
    "https://github.com/engramhq/cli.git"
  );
});

test("does not affect https url", () => {
  expect(convertSSHRepoToHTTPS("https://github.com/engramhq/cli.git")).toBe(
    "https://github.com/engramhq/cli.git"
  );
});
