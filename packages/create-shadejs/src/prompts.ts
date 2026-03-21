import * as p from "@clack/prompts";

export interface ScaffoldOptions {
  includeDemo: boolean;
  includeRouter: boolean;
  projectName: string;
}

function resolvePromptValue<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel("Scaffolding cancelled.");
    process.exit(1);
  }

  return value as T;
}

export async function collectOptions(nameArg?: string): Promise<ScaffoldOptions> {
  p.intro("create-shadejs");

  const projectName =
    nameArg ??
    resolvePromptValue(
      await p.text({
        message: "Project name:",
        placeholder: "my-app",
        validate: (value: string) => (value.trim().length === 0 ? "Name is required" : undefined)
      })
    );
  const includeRouter = resolvePromptValue(
    await p.confirm({
      initialValue: true,
      message: "Include @sarthakdev143/router?"
    })
  );
  const includeDemo = resolvePromptValue(
    await p.confirm({
      initialValue: false,
      message: "Include demo counter and posts example?"
    })
  );

  p.outro("Scaffolding...");

  return {
    includeDemo,
    includeRouter,
    projectName: String(projectName)
  };
}
