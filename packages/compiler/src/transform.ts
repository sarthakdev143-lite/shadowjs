import { parse, type ParserPlugin } from "@babel/parser";
import traverseImport, { type NodePath } from "@babel/traverse";
import { isImportNamespaceSpecifier, type ImportDeclaration } from "@babel/types";
import MagicString from "magic-string";

import { generateRPCStub } from "./rpc-gen";
import { analyzeServerImports, isServerImportPath } from "./analyzer";

interface Range {
  end: number;
  start: number;
}

const parserPlugins: ParserPlugin[] = ["typescript", "jsx"];
const traverse = (traverseImport as unknown as { default?: typeof traverseImport }).default ?? traverseImport;

function getTransformMetadata(source: string): { insertionIndex: number; ranges: Range[] } {
  const ast = parse(source, {
    plugins: parserPlugins,
    sourceType: "module"
  });
  let insertionIndex = 0;
  const ranges: Range[] = [];

  traverse(ast, {
    ImportDeclaration(path: NodePath<ImportDeclaration>) {
      if (isServerImportPath(path.node.source.value)) {
        for (const specifier of path.node.specifiers) {
          if (isImportNamespaceSpecifier(specifier)) {
            throw new Error("ShadeJS v1 does not support namespace imports from .server files.");
          }
        }

        if (typeof path.node.start === "number" && typeof path.node.end === "number") {
          ranges.push({
            end: path.node.end,
            start: path.node.start
          });
        }

        return;
      }

      const end = path.node.end;

      if (typeof end === "number") {
        insertionIndex = Math.max(insertionIndex, end);
      }
    }
  });

  return {
    insertionIndex,
    ranges
  };
}

export function transformServerImports(source: string): { code: string; map: string } | null {
  const imports = analyzeServerImports(source);

  if (imports.length === 0) {
    return null;
  }

  const { insertionIndex, ranges } = getTransformMetadata(source);
  const magicString = new MagicString(source);
  const stubBlock = imports.map((entry) => generateRPCStub(entry)).join("\n\n");

  for (const range of ranges) {
    magicString.remove(range.start, range.end);
  }

  magicString.appendLeft(insertionIndex, insertionIndex === 0 ? `${stubBlock}\n\n` : `\n\n${stubBlock}`);

  return {
    code: magicString.toString(),
    map: magicString.generateMap({ hires: true, includeContent: true }).toString()
  };
}
