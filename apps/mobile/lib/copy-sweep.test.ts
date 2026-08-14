/**
 * Copy-sweep regression test —「全 App 无残留英文展示文案」 guard (PRD §9.5).
 *
 * The mobile vitest channel is node-only (no component rendering), so this
 * test parses every `.tsx` under `app/**` and `components/**` with the
 * TypeScript AST and asserts there are no user-visible English display
 * strings:
 *
 *   - JSX text nodes (standalone English text between tags)
 *   - English `placeholder` / `accessibilityLabel` / `accessibilityHint`
 *     attribute values
 *   - English nav titles in `options={{ title: "…" }}` (Stack / Tabs screens)
 *
 * The 11 residuals flagged in COD-44 (plus three more the sweep caught:
 * emoji-picker「添加表情」/ runs「运行记录」/ description-field placeholder)
 * are exactly the shape this test exists to pin.
 *
 * Whitelist discipline: only technical strings / proper nouns / URL-email
 * format examples belong here. A new user-facing English string is a product
 * decision — add it deliberately, not silently.
 */
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const MOBILE_ROOT = resolve(__dirname, "..");
const SCAN_ROOTS = ["app", "components"];
const SCAN_EXT = /\.(tsx|ts)$/;

/**
 * Technical strings / proper nouns that legitimately stay English. Format
 * examples (URL / email) are placeholders the reviewer marked as acceptable
 * (COD-44 MEDIUM).
 */
const ALLOW_TEXT = new Set([
  "https://github.com/owner/repo",
  "you@example.com",
]);

/** User-visible JSX attributes scanned for English values. */
const VISIBLE_ATTRS = new Set([
  "placeholder",
  "accessibilityLabel",
  "accessibilityHint",
]);

/** Structural attr values that are never rendered — skip. */
const SKIP_ATTR_VALUES = new Set(["input", "search", "button"]);

/** True when the string reads as English display copy (no CJK). */
function isEnglish(s: string): boolean {
  return /[A-Za-z]{2,}/.test(s) && !/[一-鿿]/.test(s);
}

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      out.push(...collectFiles(p));
    } else if (SCAN_EXT.test(name) && !/\.test\./.test(name)) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Walk the TS AST of a source file and return user-visible English display
 * strings, each with a short locator (tag or `attr="value"`).
 */
function scanFile(file: string, src: string): string[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];

  function visit(node: ts.Node) {
    // JSX text nodes: `> English text <`. Skip HTML entities (`&quot;`,
    // `&nbsp;`…) which are glyphs, not words.
    if (ts.isJsxText(node)) {
      const text = node.getText(sf).trim();
      const noEntities = text.replace(/&[a-zA-Z]+;/g, "");
      if (
        text &&
        noEntities &&
        isEnglish(text) &&
        isEnglish(noEntities) &&
        !ALLOW_TEXT.has(text)
      ) {
        out.push(`text: ${text}`);
      }
    }
    // JSX attributes with string values.
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const name = node.name.getText(sf);
      const value = node.initializer.text;
      if (
        VISIBLE_ATTRS.has(name) &&
        !SKIP_ATTR_VALUES.has(value) &&
        isEnglish(value) &&
        !ALLOW_TEXT.has(value)
      ) {
        out.push(`${name}="${value}"`);
      }
    }
    // Nav titles: `options={{ title: "…" }}` on Stack.Screen / Tabs.Screen.
    if (ts.isPropertyAssignment(node)) {
      const propName = node.name.getText(sf);
      if (
        propName === "title" &&
        node.initializer &&
        ts.isStringLiteral(node.initializer) &&
        isEnglish(node.initializer.text) &&
        !ALLOW_TEXT.has(node.initializer.text)
      ) {
        // Only report titles inside an `options` object (nav headers /
        // tab labels), not e.g. `<Text title>` or a plain `title` field.
        const parent = node.parent;
        const parentProps = parent && ts.isObjectLiteralExpression(parent)
          ? Object.values(parent.properties)
          : [];
        const isOptionsLike =
          parentProps.length > 0 &&
          parentProps.some(
            (p) =>
              ts.isPropertyAssignment(p) && p.name.getText(sf) === "options",
          );
        if (isOptionsLike) {
          out.push(`title="${node.initializer.text}"`);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return out;
}

function findViolations(): { file: string; matches: string[] }[] {
  const violations: { file: string; matches: string[] }[] = [];
  for (const root of SCAN_ROOTS) {
    const dir = join(MOBILE_ROOT, root);
    if (!existsSync(dir)) continue;
    for (const file of collectFiles(dir)) {
      const src = readFileSync(file, "utf8");
      const matches = scanFile(file, src);
      if (matches.length > 0) {
        violations.push({ file: file.slice(MOBILE_ROOT.length + 1), matches });
      }
    }
  }
  return violations;
}

describe("copy sweep — no user-visible English display copy", () => {
  it("finds zero English text nodes / placeholders / a11y labels / nav titles", () => {
    const violations = findViolations();
    const rendered = violations
      .map((v) => `${v.file}:\n  ${v.matches.join("\n  ")}`)
      .join("\n");
    expect(rendered, `Residual English display copy:\n${rendered}`).toBe("");
  });
});
