import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => {
    const address = probe.address();
    probe.close(() => resolve(address.port));
  });
});
const origin = `http://127.0.0.1:${port}`;
const password = "test-publish-password-123";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", String(port)], {
  env: {
    ...process.env,
    PUBLISH_PASSWORD: password,
    SESSION_SECRET: "test-session-secret-that-is-deliberately-longer-than-thirty-two-characters",
  },
  stdio: "ignore",
});

const waitForServer = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${origin}/misc/publish`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timed out waiting for the test server");
};

const request = (path, body, cookie, method = "POST") => fetch(`${origin}${path}`, {
  method,
  headers: {
    "Content-Type": "application/json",
    ...(cookie ? { Cookie: cookie } : {}),
  },
  body: JSON.stringify(body),
});

try {
  await waitForServer();

  const loginPage = await fetch(`${origin}/misc/publish`);
  assert.match(await loginPage.text(), /Publishing password/, "Unauthenticated visitors see the password form");

  assert.equal((await request("/api/publish/upload", {})).status, 401, "Uploads require a session");
  assert.equal((await request("/api/publish/event", {})).status, 401, "Metadata changes require a session");
  assert.equal((await request("/api/publish/event", {}, undefined, "PUT")).status, 401, "Event edits require a session");
  assert.equal((await request("/api/publish/login", { password: "wrong-password" })).status, 401, "Wrong passwords fail");

  const login = await request("/api/publish/login", { password });
  assert.equal(login.status, 200, "The configured password succeeds");
  const setCookie = login.headers.get("set-cookie") || "";
  assert.match(setCookie, /publish_session=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=Strict/i);
  assert.match(setCookie, /Max-Age=604800/i);
  assert.ok(!setCookie.includes(password), "The cookie never contains the password");
  const cookie = setCookie.split(";", 1)[0];

  const authenticatedPage = await fetch(`${origin}/misc/publish`, { headers: { Cookie: cookie } });
  assert.match(await authenticatedPage.text(), /Event title/, "A valid session sees the publisher");

  const tampered = `${cookie.slice(0, -1)}${cookie.endsWith("a") ? "b" : "a"}`;
  assert.equal((await request("/api/publish/event", {}, tampered)).status, 401, "Tampered sessions fail");
  assert.equal((await request("/api/publish/upload", { title: "", date: "nope", files: [] }, cookie)).status, 400,
    "Authenticated input is validated before storage access");
  assert.equal((await request("/api/publish/upload", {
    title: "Test", date: "2026-09-12", files: [{ name: "photo.jpg", type: "image/jpeg", size: 123 }],
  }, cookie)).status, 400, "The upload API only accepts optimized WebP images");
  assert.equal((await request("/api/publish/event", {
    title: "Test", date: "2026-09-12", photos: [{ key: "../../secret", description: "x", alt: "x" }],
  }, cookie)).status, 400, "Object paths cannot traverse out of the event");
  assert.equal((await request("/api/publish/event", {
    originalPath: "../../secret", title: "Test", date: "2026-09-12", photos: [{}],
  }, cookie, "PUT")).status, 400, "Event edits require a valid original path");

  const logout = await request("/api/publish/logout", {});
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie") || "", /Max-Age=0/i, "Logout clears the session");

  console.log("Publish authentication, input validation, and protected routes checked.");
} finally {
  server.kill("SIGTERM");
}
