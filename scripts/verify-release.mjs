import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const packageFiles = [
  "package.json",
  "packages/compiler/package.json",
  "packages/core/package.json",
  "packages/runtime/package.json",
  "packages/state/package.json",
  "packages/shadejs/package.json"
];

const publishOrder = [
  "@sarthakdev143/compiler",
  "@sarthakdev143/core",
  "@sarthakdev143/runtime",
  "@sarthakdev143/state",
  "@sarthakdev143/shadejs"
];

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), "utf8"));
}

function fail(message) {
  console.error(`release verification failed: ${message}`);
  process.exit(1);
}

function getPublishedVersion(packageName) {
  try {
    const output = execSync(`npm view ${packageName} version`, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();

    return output.length > 0 ? output : null;
  } catch (error) {
    const stderr = String(error.stderr ?? "");
    if (stderr.includes("E404")) {
      return null;
    }

    throw error;
  }
}

const tag = process.argv[2];
if (!tag) {
  fail("missing tag argument");
}

if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
  fail(`tag "${tag}" does not match vMAJOR.MINOR.PATCH`);
}

const manifests = packageFiles.map((relativePath) => ({
  path: relativePath,
  pkg: readJson(relativePath)
}));

const workspaceManifest = manifests.find((entry) => entry.path === "package.json")?.pkg;
if (!workspaceManifest?.private) {
  fail("root package.json must stay private");
}

const releaseVersion = tag.slice(1);
const publishablePackages = manifests
  .filter((entry) => entry.path !== "package.json")
  .map((entry) => entry.pkg);

for (const pkg of publishablePackages) {
  if (pkg.version !== releaseVersion) {
    fail(`${pkg.name} version ${pkg.version} does not match tag ${tag}`);
  }

  if (!publishOrder.includes(pkg.name)) {
    fail(`${pkg.name} is not in the allowed publish list`);
  }

  if (!pkg.publishConfig || pkg.publishConfig.access !== "public") {
    fail(`${pkg.name} must set publishConfig.access to public`);
  }
}

for (const packageName of publishOrder) {
  const publishedVersion = getPublishedVersion(packageName);
  if (publishedVersion === releaseVersion) {
    fail(`${packageName}@${releaseVersion} is already published`);
  }
}

console.log(`release verification passed for ${tag}`);
