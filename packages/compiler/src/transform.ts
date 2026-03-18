import { parse, type ParserPlugin } from "@babel/parser";
import traverseImport, { type NodePath } from "@babel/traverse";
import { isImportNamespaceSpecifier, type ImportDeclaration } from "@babel/types";

import { generateRPCStub } from "./rpc-gen";
import { analyzeServerImports, isServerImportPath } from "./analyzer";

interface Range {
  end: number;
  start: number;
}

const parserPlugins: ParserPlugin[] = ["typescript", "jsx"];
const traverse = (traverseImport as unknown as { default?: typeof traverseImport }).default ?? traverseImport;

function removeRanges(source: string, ranges: Range[]): string {
  const orderedRanges = [...ranges].sort((left, right) => left.start - right.start);
  let cursor = 0;
  let output = "";

  for (const range of orderedRanges) {
    output += source.slice(cursor, range.start);
    cursor = range.end;
  }

  output += source.slice(cursor);
  return output;
}

function getInsertionIndex(source: string): number {
  const ast = parse(source, {
    plugins: parserPlugins,
    sourceType: "module"
  });
  let insertionIndex = 0;

  traverse(ast, {
    ImportDeclaration(path: NodePath<ImportDeclaration>) {
      const end = path.node.end;

      if (typeof end === "number") {
        insertionIndex = Math.max(insertionIndex, end);
      }
    }
  });

  return insertionIndex;
}

export function transformServerImports(source: string): string {
  const imports = analyzeServerImports(source);

  if (imports.length === 0) {
    return source;
  }

  const ast = parse(source, {
    plugins: parserPlugins,
    sourceType: "module"
  });
  const ranges: Range[] = [];

  traverse(ast, {
    ImportDeclaration(path: NodePath<ImportDeclaration>) {
      if (!isServerImportPath(path.node.source.value)) {
        return;
      }

      for (const specifier of path.node.specifiers) {
        if (isImportNamespaceSpecifier(specifier)) {
          throw new Error("ShadowJS v1 does not support namespace imports from .server files.");
        }
      }

      if (typeof path.node.start !== "number" || typeof path.node.end !== "number") {
        return;
      }

      ranges.push({
        end: path.node.end,
        start: path.node.start
      });
    }
  });

  const strippedSource = removeRanges(source, ranges).trim();
  const stubBlock = imports.map((entry) => generateRPCStub(entry)).join("\n\n");

  if (strippedSource.length === 0) {
    return `${stubBlock}\n`;
  }

  const insertionIndex = getInsertionIndex(strippedSource);

  if (insertionIndex === 0) {
    return `${stubBlock}\n\n${strippedSource}`;
  }

  const prefix = strippedSource.slice(0, insertionIndex).trimEnd();
  const suffix = strippedSource.slice(insertionIndex).trimStart();

  return suffix.length === 0
    ? `${prefix}\n\n${stubBlock}\n`
    : `${prefix}\n\n${stubBlock}\n\n${suffix}`;
}
