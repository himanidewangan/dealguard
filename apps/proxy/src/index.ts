import { DEFAULT_DAILY_CAP, RATE_LIMIT, type Env } from "./config.ts";
import { ApiError, errorBody } from "./errors.ts";
import { hashId, log } from "./log.ts";
import { buildDocument, parseModelOutput, readBody } from "./parse.ts";
import { openStream, readDeltas, type Deps } from "./ai.ts";
import { verifyToken } from "./token.ts";

// In-memory limits live per Worker isolate. Move to KV or a Durable Object before real traffic.
const buckets = new Map<string, number[]>();
let day = { key: "", count: 0 };

export function resetState(): void {
  buckets.clear();
  day = { key: "", count: 0 };
}

function allow(key: string, now: number, limit: number): boolean {
  if (buckets.size > 5000) buckets.clear();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

const defaultDeps: Deps = { fetch: (input, init) => fetch(input, init), now: () => Date.now() };

const json = (status: number, body: unknown, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

export async function handle(req: Request, env: Env, deps: Deps = defaultDeps): Promise<Response> {
  const start = deps.now();
  const route = new URL(req.url).pathname;
  let tokenId: string | undefined;
  const origin = req.headers.get("origin");
  const originOk = Boolean(env.ALLOWED_ORIGIN) && origin === env.ALLOWED_ORIGIN;
  const cors: Record<string, string> = originOk
    ? { "access-control-allow-origin": origin!, "access-control-allow-headers": "content-type, x-install-token", "access-control-allow-methods": "POST, OPTIONS", vary: "Origin" }
    : {};
  const done = (res: Response) => {
    log({ route, status: res.status, latencyMs: deps.now() - start, tokenId });
    return res;
  };

  try {
    if (!originOk) throw new ApiError("forbidden_origin", 403, "This request is not allowed from here.");
    if (req.method === "OPTIONS") return done(new Response(null, { status: 204, headers: cors }));
    if (route !== "/explain") throw new ApiError("not_found", 404, "Unknown route.");
    if (req.method !== "POST") throw new ApiError("method_not_allowed", 405, "Use POST.");

    const token = req.headers.get("x-install-token");
    if (!token) throw new ApiError("missing_token", 401, "This install has no access token.");
    if (!env.INSTALL_TOKEN_SECRET) throw new ApiError("not_configured", 500, "The server is not set up yet.");
    const id = await verifyToken(env.INSTALL_TOKEN_SECRET, token);
    if (!id) throw new ApiError("invalid_token", 401, "This install token is not valid.");
    tokenId = await hashId(id);

    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
    if (!allow(`t:${id}`, start, RATE_LIMIT.perMinutePerToken) || !allow(`ip:${ip}`, start, RATE_LIMIT.perMinutePerIp)) {
      throw new ApiError("rate_limited", 429, "Too many requests. Wait a minute and try again.");
    }
    const today = new Date(start).toISOString().slice(0, 10);
    if (day.key !== today) day = { key: today, count: 0 };
    if (day.count >= (Number(env.DAILY_CAP) || DEFAULT_DAILY_CAP)) throw new ApiError("daily_limit", 429, "The daily limit is reached. Try again tomorrow.");

    const doc = buildDocument(await readBody(req));
    day.count++;
    const upstream = await openStream(env, doc, deps);

    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        let status = 200;
        let text = "";
        try {
          for await (const t of readDeltas(upstream.body)) {
            text += t;
            send("delta", { text: t });
          }
          send("done", parseModelOutput(text));
        } catch (e) {
          const err = e instanceof ApiError ? e : new ApiError("upstream_error", 502, "The AI service returned an error. Try again.");
          status = err.status;
          send("error", errorBody(err).error);
        } finally {
          upstream.close();
          log({ route, status, latencyMs: deps.now() - start, tokenId });
          controller.close();
        }
      },
    });
    return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream", "cache-control": "no-store", ...cors } });
  } catch (e) {
    const err = e instanceof ApiError ? e : new ApiError("internal", 500, "Something went wrong. Try again.");
    return done(json(err.status, errorBody(err), cors));
  }
}

export default { fetch: (req: Request, env: Env) => handle(req, env) };
