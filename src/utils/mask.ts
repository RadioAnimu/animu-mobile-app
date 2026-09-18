/** Fixed-width mask so the hidden part's length is never revealed. */
const BULLETS = "•••";

/** Keeps at most the first two characters, then masks the rest. */
function maskHead(value: string): string {
  if (!value) return BULLETS;
  const visible = value.length <= 2 ? value.slice(0, 1) : value.slice(0, 2);
  return `${visible}${BULLETS}`;
}

/**
 * `ricardo@gmail.com` → `ri•••@gmail.com`.
 *
 * The domain stays readable (people recognize their own provider) while the
 * local part — the identifying half — is hidden from anyone glancing at the
 * screen. Falls back to `maskIdentifier` for input that is not an email.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0 || at === email.length - 1) return maskIdentifier(email);
  return `${maskHead(email.slice(0, at))}@${email.slice(at + 1)}`;
}

/** `@haruka_yuki` → `@ha•••`. Keeps the `@` so the platform stays obvious. */
export function maskHandle(handle: string): string {
  return `@${maskHead(handle.replace(/^@/, ""))}`;
}

/**
 * Long opaque ids keep their first and last two digits (`123456789` →
 * `12•••89`) so the owner can still tell two accounts apart; short values
 * are fully masked.
 */
export function maskIdentifier(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return BULLETS;
  return `${trimmed.slice(0, 2)}${BULLETS}${trimmed.slice(-2)}`;
}
