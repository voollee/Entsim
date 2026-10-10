import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { authenticator } from "../apps/server/auth.ts";
test("OAuth bearer verification accepts signed scoped tokens and rejects bad audience, scope, expiry and signature", async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = {
    ...(await exportJWK(publicKey)),
    kid: "test",
    alg: "RS256",
    use: "sig",
  };
  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ keys: [jwk] }));
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const issuer =
    "http://127.0.0.1:" + (server.address() as { port: number }).port;
  const auth = authenticator({
    mode: "oauth",
    issuer,
    audience: "lemon-test",
    jwksUrl: issuer + "/jwks",
  });
  const token = (
    audience = "lemon-test",
    scope = "lemon:play",
    expires = "1h",
  ) =>
    new SignJWT({ scope })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setSubject("alice")
      .setIssuer(issuer)
      .setAudience(audience)
      .setExpirationTime(expires)
      .sign(privateKey);
  try {
    assert.equal(await auth("Bearer " + (await token())), issuer + "|alice");
    for (const t of [
      await token("other"),
      await token("lemon-test", "other"),
      await token("lemon-test", "lemon:play", "-1h"),
    ])
      await assert.rejects(auth("Bearer " + t), /invalid/);
    const valid = await token();
    await assert.rejects(
      auth("Bearer " + valid.slice(0, -10) + "xxxxxxxxxx"),
      /invalid/,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
