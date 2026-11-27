// Test-only Auth provider and PostgreSQL HTTP adapter, bound to loopback.
import { createServer } from "node:http";
import { createHash, createHmac } from "node:crypto";
import {
  OPERATOR_ID,
  ADMIN_ID,
  setOperatorApproval,
  seedVerificationData,
  seedDocumentChecklist,
  setVerificationDelay,
  resetOperatorData,
  handleOperatorApi,
} from "./operator-api.mjs";

let user, challenge, usedCode, refreshes;
const accounts = new Map();
const passwords = new Map();
const activeUsers = new Set();
function profile(email, id) {
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email,
    email_confirmed_at: null,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: "2026-11-27T00:00:00Z",
  };
}
function reset() {
  challenge = "";
  usedCode = false;
  refreshes = 0;
  accounts.clear();
  passwords.clear();
  activeUsers.clear();
  user = profile("traveller@example.test", OPERATOR_ID);
  accounts.set(user.email, user);
  passwords.set(user.id, "strong test password");
}
reset();
function session(expired = false, actor = user) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: actor.id,
      email: actor.email,
      aud: "authenticated",
      role: "authenticated",
      iat: now - (expired ? 7200 : 0),
      exp: now + (expired ? -3600 : 3600),
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", "local-fixture-only")
    .update(`${header}.${payload}`)
    .digest("base64url");
  return {
    access_token: `${header}.${payload}.${signature}`,
    token_type: "bearer",
    expires_in: expired ? -3600 : 3600,
    expires_at: now + (expired ? -3600 : 3600),
    refresh_token: `local-test-refresh-${actor.id}`,
    user: actor,
  };
}
function authenticated(req) {
  if (req.headers.authorization === "Bearer sb_secret_local-test-only") return { id: ADMIN_ID, service_role: true };
  try {
    const token = String(req.headers.authorization ?? "").replace(
      /^Bearer /,
      "",
    );
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    );
    return (
      [...accounts.values()].find(
        (account) =>
          account.id === payload.sub &&
          account.email_confirmed_at &&
          activeUsers.has(account.id),
      ) ?? null
    );
  } catch {
    return null;
  }
}
createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:3242");
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3241");
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] ?? "*",
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks);
  let body = {};
  if (
    raw.length &&
    String(req.headers["content-type"]).includes("application/json")
  )
    body = JSON.parse(raw.toString());
  function send(status, data) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(req.method === "HEAD" ? undefined : JSON.stringify(data));
  }
  function fail(status, code) {
    send(status, { code, error_code: code, msg: code });
  }
  if (url.pathname === "/health") return send(200, { ok: true });
  if (url.pathname === "/test/reset") {
    reset();
    await resetOperatorData();
    return send(200, {});
  }
  if (url.pathname === "/test/operator/pending") {
    await setOperatorApproval(false);
    return send(200, {});
  }
  if (url.pathname === "/test/operator/approve") {
    await setOperatorApproval(true);
    return send(200, {});
  }
  if (url.pathname === "/test/stats") return send(200, { refreshes });
  if (url.pathname === "/test/verification/seed") {
    await seedVerificationData();
    return send(200, {});
  }
  if (url.pathname === "/test/checklist/seed") {
    await seedDocumentChecklist();
    return send(200, {});
  }
  if (url.pathname === "/test/verification/slow") {
    setVerificationDelay(2500);
    return send(200, {});
  }
  if (url.pathname === "/test/verification/fast") {
    setVerificationDelay(0);
    return send(200, {});
  }
  if (url.pathname === "/test/expired-session") return send(200, session(true));
  const actor = authenticated(req);
  if (await handleOperatorApi(req, res, url, body, actor, send)) return;
  if (url.pathname === "/auth/v1/signup") {
    const email = body.email;
    user =
      accounts.get(email) ??
      profile(email, email === "admin@example.test" ? ADMIN_ID : OPERATOR_ID);
    accounts.set(email, user);
    passwords.set(user.id, body.password);
    challenge = body.code_challenge;
    usedCode = false;
    return send(200, user);
  }
  if (url.pathname === "/auth/v1/resend") return send(200, {});
  if (url.pathname === "/auth/v1/recover") {
    const account = accounts.get(body.email);
    if (account) {
      user = account;
      challenge = body.code_challenge;
      usedCode = false;
    }
    return send(200, {});
  }
  if (url.pathname === "/auth/v1/token") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "pkce") {
      if (
        body.auth_code !== "test-confirmation-code" ||
        usedCode ||
        !challenge ||
        createHash("sha256")
          .update(body.code_verifier || "")
          .digest("base64url") !== challenge
      )
        return fail(400, "bad_code_verifier");
      usedCode = true;
      activeUsers.add(user.id);
      user.email_confirmed_at = "2026-11-27T00:00:00Z";
      return send(200, session());
    }
    if (grant === "password") {
      const account = accounts.get(body.email);
      if (!account || body.password !== passwords.get(account.id))
        return fail(400, "invalid_credentials");
      if (!account.email_confirmed_at) return fail(400, "email_not_confirmed");
      user = account;
      activeUsers.add(user.id);
      return send(200, session());
    }
    if (grant === "refresh_token") {
      const account = [...accounts.values()].find(
        (value) =>
          body.refresh_token === `local-test-refresh-${value.id}` &&
          activeUsers.has(value.id),
      );
      if (!account) return fail(400, "refresh_token_not_found");
      refreshes++;
      return send(200, session(false, account));
    }
  }
  if (url.pathname === "/auth/v1/user") {
    if (!actor) return fail(401, "bad_jwt");
    if (req.method === "PUT" && body.password)
      passwords.set(actor.id, body.password);
    return send(200, actor);
  }
  if (url.pathname === "/auth/v1/logout") {
    if (actor) activeUsers.delete(actor.id);
    return send(200, {});
  }
  return fail(404, "not_found");
}).listen(3242, "127.0.0.1");
