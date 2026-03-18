import { parse, type ParserPlugin } from "@babel/parser";
import traverseImport, { type NodePath } from "@babel/traverse";
import {
  isIdentifier,
  isImportDefaultSpecifier,
  isImportNamespaceSpecifier,
  isImportSpecifier,
  type ImportDeclaration,
  type ImportDefaultSpecifier,
  type ImportSpecifier
} from "@babel/types";

export interface ServerImport {
  importedName: string;
  localName: string;
  serverFilePath: string;
}

const parserPlugins: ParserPlugin[] = ["typescript", "jsx"];
const traverse = (traverseImport as unknown as { default?: typeof traverseImport }).default ?? traverseImport;

export function isServerImportPath(value: string): boolean {
  return /\.server(?:\.[cm]?[jt]sx?)?$/.test(value);
}

function getImportedName(specifier: ImportDefaultSpecifier | ImportSpecifier): string {
  if (isImportDefaultSpecifier(specifier)) {
    return "default";
  }

  return isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value;
}

export function analyzeServerImports(source: string): ServerImport[] {
  const ast = parse(source, {
    plugins: parserPlugins,
    sourceType: "module"
  });
  const imports: ServerImport[] = [];

  traverse(ast, {
    ImportDeclaration(path: NodePath<ImportDeclaration>) {
      const serverFilePath = path.node.source.value;

      if (!isServerImportPath(serverFilePath)) {
        return;
      }

      for (const specifier of path.node.specifiers) {
        if (isImportNamespaceSpecifier(specifier)) {
          throw new Error("ShadowJS v1 does not support namespace imports from .server files.");
        }

        imports.push({
          importedName: getImportedName(specifier),
          localName: specifier.local.name,
          serverFilePath
        });
      }
    }
  });

  return imports;
}
