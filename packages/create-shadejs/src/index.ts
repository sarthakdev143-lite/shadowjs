import { collectOptions } from "./prompts";
import { scaffold } from "./scaffold";

async function main(): Promise<void> {
  const options = await collectOptions(process.argv[2]);
  const root = scaffold(options);

  console.log(`\nDone. Now run:\n  cd ${options.projectName}\n  npm install\n  npm run dev\n`);
  console.log(`Scaffolded at ${root}`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
