import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { zipDir } from "./zip.mjs";

// reads entries back from the central directory, so the test checks what an unzipper would see
function readZip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = {};
  for (let i = 0; i < count; i++) {
    const nameLen = buf.readUInt16LE(p + 28), extra = buf.readUInt16LE(p + 30), comment = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42), size = buf.readUInt32LE(p + 20);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    const dataAt = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    entries[name] = inflateRawSync(buf.subarray(dataAt, dataAt + size)).toString("utf8");
    p += 46 + nameLen + extra + comment;
  }
  return entries;
}

describe("zipDir", () => {
  it("puts the folder's files at the zip root with forward-slash paths, which itch.io needs", () => {
    const dir = mkdtempSync(join(tmpdir(), "zip-"));
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "index.html"), "<html>hi</html>");
    writeFileSync(join(dir, "assets", "app.js"), "console.log(1)");
    writeFileSync(join(dir, ".gitkeep"), "");
    const out = join(dir, "..", `out-${Date.now()}.zip`);
    zipDir(dir, out);
    const entries = readZip(readFileSync(out));
    expect(Object.keys(entries).sort()).toEqual(["assets/app.js", "index.html"]);
    expect(entries["index.html"]).toBe("<html>hi</html>");
    expect(entries["assets/app.js"]).toBe("console.log(1)");
  });
});
