// npm run package: builds, then zips the game for itch.io (S1-08). The game is prototype/ (plain scripts)
// plus js/net.js, the network layer bundled from src/proto by npm run build:proto.
import { cpSync, existsSync, rmSync } from "node:fs";
import { zipDir } from "./zip.mjs";

if (!existsSync("prototype/js/net.js")) {
  console.error("prototype/js/net.js is missing: run npm run build:proto first (npm run package does this for you)");
  process.exit(1);
}
rmSync("dist-itch", { recursive: true, force: true });
cpSync("prototype", "dist-itch", { recursive: true, filter: (src) => !src.endsWith("README.md") });
zipDir("dist-itch", "homestead.zip");
console.log("wrote homestead.zip: upload it to itch.io as an HTML project, played in the browser, 960 x 540");
