import type { ServerImport } from "./analyzer";

export function getRPCRoutePath(serverFilePath: string): string {
  const normalizedPath = serverFilePath.split("?")[0].replace(/\\/g, "/");
  const withoutExtension = normalizedPath.replace(/\.[^.\/]+$/, "");
  const withoutServerSuffix = withoutExtension.replace(/\.server$/, "");
  const segments = withoutServerSuffix
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..");

  return segments.join("/");
}

function getTypeAliasName(localName: string): string {
  return `__ShadowServerFn_${localName.replace(/[^A-Za-z0-9_$]/g, "_")}`;
}

export function generateRPCStub(serverImport: ServerImport): string {
  const { importedName, localName, serverFilePath } = serverImport;
  const routePath = getRPCRoutePath(serverFilePath);
  const aliasName = getTypeAliasName(localName);
  const exportReference = importedName === "default" ? "default" : importedName;

  return [
    `type ${aliasName} = typeof import("${serverFilePath}").${exportReference};`,
    `export const ${localName} = async (`,
    `  ...args: Parameters<${aliasName}>`,
    `): Promise<Awaited<ReturnType<${aliasName}>>> => {`,
    `  const response = await fetch("/__rpc/${routePath}/${importedName}", {`,
    `    method: "POST",`,
    `    headers: { "Content-Type": "application/json" },`,
    `    body: JSON.stringify(args)`,
    "  });",
    "",
    "  if (!response.ok) {",
    `    throw new Error("ShadeJS RPC ${localName} failed.");`,
    "  }",
    "",
    `  return (await response.json()) as Awaited<ReturnType<${aliasName}>>;`,
    "};"
  ].join("\n");
}
