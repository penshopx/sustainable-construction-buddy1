import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import ts from "typescript";

// Deliberately fail closed: an indirect/dynamic config needs an explicit policy
// update rather than silently escaping the preflight check.
export function assertIsolatedViteCaches(sources: Record<string, string>) {
  const owners = new Map<string, string>();
  for (const [filename, source] of Object.entries(sources)) {
    const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
    const factories = new Set<string>();
    const namespaces = new Set<string>();
    for (const statement of file.statements) {
      if (!ts.isImportDeclaration(statement) ||
          !ts.isStringLiteral(statement.moduleSpecifier) ||
          statement.moduleSpecifier.text !== "vite") continue;
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const binding of bindings.elements) {
          if ((binding.propertyName ?? binding.name).text === "createServer") {
            factories.add(binding.name.text);
          }
        }
      } else if (bindings && ts.isNamespaceImport(bindings)) {
        namespaces.add(bindings.name.text);
      }
    }

    function visit(node: ts.Node) {
      if (ts.isIdentifier(node) && factories.has(node.text) &&
          !ts.isImportSpecifier(node.parent)) {
        assert.ok(ts.isCallExpression(node.parent) && node.parent.expression === node,
          `${filename}: call the imported Vite factory directly so cache isolation can be checked`);
      }
      if (ts.isIdentifier(node) && namespaces.has(node.text) &&
          !ts.isNamespaceImport(node.parent)) {
        assert.ok(ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node,
          `${filename}: access Vite namespace members directly so cache isolation can be checked`);
        if (node.parent.name.text === "createServer") {
          assert.ok(ts.isCallExpression(node.parent.parent) && node.parent.parent.expression === node.parent,
            `${filename}: call the imported Vite factory directly so cache isolation can be checked`);
        }
      }
      if (ts.isCallExpression(node) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
           (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
          node.arguments[0] && ts.isStringLiteral(node.arguments[0]) &&
          node.arguments[0].text === "vite") {
        assert.fail(`${filename}: use a static Vite import so cache isolation can be checked`);
      }
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const factory = (ts.isIdentifier(callee) && factories.has(callee.text)) ||
          (ts.isPropertyAccessExpression(callee) &&
           ts.isIdentifier(callee.expression) && namespaces.has(callee.expression.text) &&
           callee.name.text === "createServer");
        if (factory) {
          const location = `${filename}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}`;
          const config = node.arguments[0];
          assert.ok(config && ts.isObjectLiteralExpression(config),
            `${location}: createServer requires an inline config with an isolated cacheDir`);
          // Spreads/computed keys could overwrite cacheDir after this check.
          assert.ok(config.properties.every(property =>
            !ts.isSpreadAssignment(property) &&
            !(property.name && ts.isComputedPropertyName(property.name))),
          `${location}: spread/computed Vite options cannot prove cache isolation`);
          const caches = config.properties.filter(property =>
            property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
            property.name.text === "cacheDir");
          assert.equal(caches.length, 1, `${location}: set one explicit test-only cacheDir`);
          const cache = caches[0];
          assert.ok(ts.isPropertyAssignment(cache) && ts.isStringLiteral(cache.initializer),
            `${location}: cacheDir must be a literal test-only path`);
          const value = cache.initializer.text;
          assert.match(value, /^node_modules\/\.vite-[a-z0-9-]+-tests$/,
            `${location}: cacheDir must not share the default preview cache`);
          assert.ok(!owners.has(value),
            `${location}: cacheDir ${value} is already used by ${owners.get(value)}`);
          owners.set(value, location);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(file);
  }
  return owners.size;
}

export async function checkIntegrationCachePolicy() {
  const directory = new URL("../../src/lib/", import.meta.url);
  const names = (await readdir(directory)).filter(name => name.endsWith(".integration.test.ts")).sort();
  assert.ok(names.length > 0, "No integration suites found: check the scan directory");
  const sources = Object.fromEntries(await Promise.all(names.map(async name =>
    [name, await readFile(new URL(name, directory), "utf8")])));
  const count = assertIsolatedViteCaches(sources);
  assert.ok(count > 0, "No Vite test servers found: check the cache-policy scanner");
  return { suites: names.length, servers: count };
}
