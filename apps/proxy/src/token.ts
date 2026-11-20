const enc = new TextEncoder();

const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const key = (secret: string, usage: "sign" | "verify") => crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);

/** Install token = `<id>.<HMAC-SHA256(id)>`. It identifies an install; it is not a secret once shipped in a build. */
export async function signToken(secret: string, id: string): Promise<string> {
  return `${id}.${b64url(await crypto.subtle.sign("HMAC", await key(secret, "sign"), enc.encode(id)))}`;
}

/** Returns the install id when the signature is valid, otherwise undefined. */
export async function verifyToken(secret: string, token: string): Promise<string | undefined> {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return undefined;
  const id = token.slice(0, dot);
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(secret, "verify"), fromB64url(token.slice(dot + 1)), enc.encode(id));
    return ok ? id : undefined;
  } catch {
    return undefined;
  }
}
