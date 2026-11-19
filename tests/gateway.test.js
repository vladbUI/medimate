import { it, expect } from "vitest";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
it("private gateway rejects missing credentials and foreign origins; paid generation stays disabled", async () => {
  const token = randomUUID();
  const dir = mkdtempSync(join(tmpdir(), "medimate-test-"));
  const child = spawn(process.execPath, ["server/index.js"], {
    env: {
      ...process.env,
      PORT: "0",
      MEDIMATE_DATA_DIR: dir,
      MEDIMATE_ACCESS_TOKEN: token,
      AI_ENABLED: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const url = await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(Error("Gateway did not start")),
        8000,
      );
      child.on("error", reject);
      child.stdout.on("data", (data) => {
        const m = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
        if (m) {
          clearTimeout(timeout);
          resolve(m[0]);
        }
      });
    });
    expect((await fetch(url + "/api/ai/status")).status).toBe(401);
    const headers = { Authorization: `Bearer ${token}` };
    expect(
      (
        await fetch(url + "/api/ai/status", {
          headers: { ...headers, Origin: "https://untrusted.example" },
        })
      ).status,
    ).toBe(403);
    const status = await (
      await fetch(url + "/api/ai/status", { headers })
    ).json();
    expect(status.enabled).toBe(false);
    expect(status.remainingPhp).toBe(500);
    expect(
      (
        await fetch(url + "/api/ai/generate", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
    ).toBe(503);
  } finally {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
    rmSync(dir, { recursive: true, force: true });
  }
}, 15000);
