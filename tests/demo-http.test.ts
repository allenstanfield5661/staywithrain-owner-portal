import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 38551;
const origin = `http://127.0.0.1:${port}`;

let child: ChildProcess | undefined;
let logs = "";

function startServer(): Promise<void> {
  const env: NodeJS.ProcessEnv = { ...process.env, DATA_MODE: "mock" };
  for (const key of Object.keys(env)) {
    if (/HOSTAWAY|BLOB|SECRET|PASSWORD|TOKEN|API_KEY|NETLIFY/i.test(key)) delete env[key];
  }
  child = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk: Buffer) => {
    logs += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    logs += chunk.toString();
  });
  return waitForReady();
}

async function waitForReady(): Promise<void> {
  const started = Date.now();
  let lastError = "server did not answer";
  while (Date.now() - started < 90000) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error(`Sample server exited ${child.exitCode}\n${logs.slice(-4000)}`);
    }
    try {
      const response = await fetch(`${origin}/demo`, { redirect: "manual" });
      if (response.status > 0) return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "connection failed";
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`${lastError}\n${logs.slice(-4000)}`);
}

async function load(pathname: string): Promise<Response> {
  return fetch(`${origin}${pathname}`, { redirect: "manual", headers: { cookie: "" } });
}

function isSentToSignIn(status: number, location: string, body: string): boolean {
  if (status >= 300 && status < 400) {
    return location.endsWith("/") || location.includes("/preview-gate");
  }
  return body.includes("NEXT_REDIRECT;replace;/;307;") || body.includes('http-equiv="refresh" content="1;url=/"');
}

describe("sample portal over HTTP", () => {
  it(
    "serves /demo without a session and keeps the owner routes protected",
    async () => {
      await startServer();

      const demo = await load("/demo");
      const demoHtml = await demo.text();
      expect(demo.status, demoHtml.slice(0, 800)).toBe(200);
      expect(demoHtml).toContain("Porch Light Cottage");
      expect(demoHtml).toContain("Bayou Breeze Suite");
      expect(demoHtml).toContain("Sample Owner Portal");
      expect(demoHtml).toContain("Call 228-875-4496");
      expect(demoHtml).not.toContain("Peaceful Pearl");
      expect(demoHtml).not.toContain("james.okonkwo@example.com");
      expect(demoHtml).not.toContain("NEXT_REDIRECT");
      expect(demo.headers.get("set-cookie") ?? "").not.toMatch(/rs_owner_session|rs_preview_access/);

      for (const pathname of ["/demo/calendar", "/demo/reservations", "/demo/statements", "/demo/golf-cart"]) {
        const response = await load(pathname);
        expect(response.status, pathname).toBe(200);
        const html = await response.text();
        expect(html, pathname).toContain("Sample Owner");
        expect(html, pathname).not.toContain("Peaceful Pearl");
      }

      for (const pathname of ["/portal", "/admin"]) {
        const response = await load(pathname);
        const body = await response.text();
        expect(isSentToSignIn(response.status, response.headers.get("location") ?? "", body), pathname).toBe(true);
        expect(body, pathname).not.toContain("Peaceful Pearl");
        expect(body, pathname).not.toContain("Porch Light Cottage");
        expect(body, pathname).not.toContain("james.okonkwo@example.com");
      }

      const dashboard = await load("/dashboard");
      expect(dashboard.status).toBe(404);

      const calendar = await load("/api/calendar");
      expect(calendar.status).toBe(401);
      const calendarBody = await calendar.text();
      expect(calendarBody).not.toContain("Peaceful Pearl");
      expect(calendarBody).not.toContain("Porch Light Cottage");

      const adminApi = await load("/api/admin");
      expect(adminApi.status).toBe(401);
    },
    120000,
  );
});

afterAll(() => {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
});
