import plexRegular from "./fonts/IBMPlexMono-Regular.ttf?url";
import plexSemiBold from "./fonts/IBMPlexMono-SemiBold.ttf?url";
import pixelify from "./fonts/PixelifySans.ttf?url";

/**
 * Loads the two typefaces (both SIL Open Font License, see the OFL files beside them) before the
 * first screen draws, so canvas text never flashes in a fallback font.
 */
export function loadFonts(): Promise<unknown> {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return Promise.resolve();
  const faces = [
    new FontFace("Pixelify Sans", `url(${pixelify})`, { weight: "400 700" }),
    new FontFace("IBM Plex Mono", `url(${plexRegular})`, { weight: "400 500" }),
    new FontFace("IBM Plex Mono", `url(${plexSemiBold})`, { weight: "600 700" }),
  ];
  return Promise.all(
    faces.map((f) =>
      f.load().then(
        (loaded) => document.fonts.add(loaded),
        () => undefined, // a missing font falls back to the system monospace; never fatal
      ),
    ),
  );
}
