// npm run package: builds, then zips dist/ into homestead.zip for itch.io (S1-08)
import { existsSync } from "node:fs";
import { zipDir } from "./zip.mjs";

if (!existsSync("dist/index.html")) {
  console.error("dist/index.html is missing: run the build first (npm run package does this for you)");
  process.exit(1);
}
zipDir("dist", "homestead.zip");
console.log("wrote homestead.zip: upload it to itch.io as an HTML project, played in the browser, 960 x 540");
