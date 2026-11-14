// no 0/O or 1/I, so a code read aloud or off a screen can't be mistyped
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function makeCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** the code in canonical form, or null if it can't be one we handed out */
export function normalizeCode(typed: string): string | null {
  const code = typed.trim().toUpperCase();
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}

// the public PeerJS server is shared, so prefix ids to stay out of other apps' namespace
export function peerId(code: string): string {
  return `homestead-${code.toLowerCase()}`;
}
