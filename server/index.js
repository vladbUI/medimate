import http from "node:http";
import { mkdirSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { Budget } from "./budget.js";
import { z } from "zod";
// This is a loopback-only private gateway, not an internet-facing authentication system.
const token = process.env.MEDIMATE_ACCESS_TOKEN || "";
const origin = process.env.MEDIMATE_ORIGIN || "http://127.0.0.1:5173";
const dir =
  process.env.MEDIMATE_DATA_DIR ||
  fileURLToPath(new URL("./data/", import.meta.url));
mkdirSync(dir, { recursive: true });
const budget = new Budget(
  resolve(dir, "budget.sqlite"),
  Number(process.env.MONTHLY_LIMIT_PHP || 500),
);
// Only a server-controlled local module may implement paid generation. No user-selected URLs or providers.
let adapter = null;
if (process.env.AI_ENABLED === "true" && process.env.MEDIMATE_ADAPTER) {
  if (token.length < 32)
    throw Error("Configure an access token of at least 32 characters.");
  adapter = (
    await import(new URL(process.env.MEDIMATE_ADAPTER, import.meta.url).href)
  ).default;
  if (
    typeof adapter?.generate !== "function" ||
    typeof adapter?.maxCostPhp !== "function"
  )
    throw Error("Invalid AI adapter.");
}
const requestSchema = z
  .object({
    requestId: z.string().uuid(),
    consent: z.literal(true),
    pages: z
      .array(
        z.object({
          documentId: z.string().min(1).max(200),
          page: z.number().int().min(1).max(3000),
          text: z.string().min(1).max(12000),
        }),
      )
      .min(1)
      .max(5),
  })
  .strict();
const outputSchema = z
  .array(
    z.object({
      prompt: z.string().min(1).max(4000),
      answer: z.string().min(1).max(10000),
      documentId: z.string(),
      page: z.number().int(),
      quote: z.string().min(1).max(10000),
    }),
  )
  .max(30);
function authorized(value = "") {
  const wanted = Buffer.from(`Bearer ${token}`),
    actual = Buffer.from(value);
  return (
    token.length >= 32 &&
    wanted.length === actual.length &&
    timingSafeEqual(wanted, actual)
  );
}
const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const send = (status, body) => {
    res.writeHead(status);
    res.end(JSON.stringify(body));
  };
  if (
    !["127.0.0.1", "localhost"].includes((req.headers.host || "").split(":")[0])
  )
    return send(403, { error: "Invalid host." });
  if (req.headers.origin && req.headers.origin !== origin)
    return send(403, { error: "Origin denied." });
  if (!authorized(req.headers.authorization))
    return send(401, { error: "Private access token required." });
  if (req.url === "/api/ai/status" && req.method === "GET")
    return send(200, { enabled: !!adapter, ...budget.status() });
  if (req.url !== "/api/ai/generate" || req.method !== "POST")
    return send(404, { error: "Not found." });
  if (!adapter)
    return send(503, {
      error: "Paid AI is disabled. Configure a reviewed server adapter first.",
    });
  if (!req.headers["content-type"]?.startsWith("application/json"))
    return send(415, { error: "JSON required." });
  try {
    let body = "";
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 100000) return send(413, { error: "Request too large." });
      body += chunk;
    }
    const input = requestSchema.parse(JSON.parse(body));
    const max = await adapter.maxCostPhp(input); // Must include all provider costs, token ceilings, FX buffer and taxes.
    try {
      budget.reserve(input.requestId, max);
    } catch (e) {
      return send(429, { error: e.message });
    }
    // Reservation remains charged on success, failure, disconnect, crash, or unknown provider outcome.
    const result = outputSchema.parse(
      await adapter.generate(input, { signal: AbortSignal.timeout(60000) }),
    );
    for (const c of result)
      if (
        !input.pages.some(
          (p) =>
            p.documentId === c.documentId &&
            p.page === c.page &&
            p.text.includes(c.quote),
        )
      )
        throw Error("Generated source citation did not match.");
    send(200, {
      drafts: result.map((c) => ({ ...c, verified: false })),
      budget: budget.status(),
    });
  } catch {
    send(400, {
      error:
        "Request or provider result rejected. If a paid call began, its reservation is retained.",
    });
  }
});
server.requestTimeout = 70000;
server.headersTimeout = 10000;
server.listen(Number(process.env.PORT || 8787), "127.0.0.1", () =>
  console.log(
    `MediMate private AI gateway: http://127.0.0.1:${server.address().port} (${adapter ? "adapter configured" : "paid AI disabled"})`,
  ),
);
