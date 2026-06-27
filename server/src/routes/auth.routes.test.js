import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../app.js";

async function withServer(run) {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("protected HTTP routes reject missing sessions", async () => {
  await withServer(async (baseUrl) => {
    for (const path of ["/auth/me", "/documents"]) {
      const response = await fetch(`${baseUrl}${path}`);
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), {
        ok: false,
        error: "Authentication required",
      });
    }
  });
});

test("auth endpoints return helpful validation errors before database access", async () => {
  await withServer(async (baseUrl) => {
    const signup = await fetch(`${baseUrl}/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "invalid", password: "short" }),
    });
    assert.equal(signup.status, 400);
    assert.equal((await signup.json()).error, "A valid email is required");

    const login = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(login.status, 400);
    assert.equal((await login.json()).error, "Email and password are required");

    const logout = await fetch(`${baseUrl}/auth/logout`, { method: "POST" });
    assert.equal(logout.status, 200);
    const clearedCookie = logout.headers.get("set-cookie");
    assert.match(clearedCookie, /HttpOnly/i);
    assert.match(clearedCookie, /SameSite=Lax/i);
    assert.match(clearedCookie, /Path=\//i);
  });
});
