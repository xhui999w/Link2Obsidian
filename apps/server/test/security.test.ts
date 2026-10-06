import assert from "node:assert/strict";
import test from "node:test";
import { createServer, request } from "node:http";
import { connect } from "node:net";
import { isPublicIp, validatePublicUrl } from "../src/infrastructure/url-security.js";
import { EgressProxy } from "../src/infrastructure/egress-proxy.js";

test("blocks IPv4/IPv6 non-public and special-purpose networks", async () => {
  const blocked = [
    "0.0.0.0", "10.0.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1",
    "192.168.1.1", "100.64.0.1", "192.0.2.1", "198.18.0.1", "198.51.100.1",
    "203.0.113.1", "224.0.0.1", "255.255.255.255", "::", "::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "fc00::1", "fe80::1", "ff02::1",
    "64:ff9b::a00:1", "2001:db8::1", "2001::1", "2001:10::1", "2002:7f00:1::",
    "3fff::1",
  ];
  for (const ip of blocked) {
    assert.equal(isPublicIp(ip), false, ip);
    await assert.rejects(validatePublicUrl(`http://${ip.includes(":") ? "[" + ip + "]" : ip}/`), { code: "UNSAFE_URL" });
  }
  for (const ip of ["1.1.1.1", "8.8.8.8", "93.184.215.14", "2606:4700:4700::1111"]) {
    assert.equal(isPublicIp(ip), true, ip);
  }
});

test("blocks obfuscated localhost, credentials, schemes and mixed DNS answers", async () => {
  for (const url of ["http://localhost", "http://localhost.", "http://a.localhost",
    "http://2130706433", "http://0x7f000001", "http://127.1",
    "http://user:pass@example.com", "file:///etc/passwd", "ftp://example.com"]) {
    await assert.rejects(validatePublicUrl(url), { code: "UNSAFE_URL" }, url);
  }
  await assert.rejects(validatePublicUrl("https://example.com", async () => [
    { address: "8.8.8.8", family: 4 }, { address: "10.0.0.1", family: 4 },
  ]), { code: "UNSAFE_URL" });
  await assert.rejects(validatePublicUrl("https://example.com", async () => []), { code: "UNSAFE_URL" });
  const validated = await validatePublicUrl("https://example.com", async () => [{ address: "8.8.8.8", family: 4 }]);
  assert.equal(validated.address, "8.8.8.8"); // Exact socket target, not a second hostname lookup.
  const dualStack = await validatePublicUrl("https://example.com", async () => [
    { address: "2606:4700:4700::1111", family: 6 }, { address: "8.8.8.8", family: 4 },
  ]);
  assert.equal(dualStack.address, "8.8.8.8");
});

test("egress proxy refuses HTTP and HTTPS CONNECT to loopback", async () => {
  const proxy = new EgressProxy();
  const address = new URL(await proxy.open());
  try {
    const status = await new Promise<number>((resolve, reject) => {
      const req = request({ hostname: address.hostname, port: address.port, path: "http://127.0.0.1:80/" }, response => {
        response.resume(); resolve(response.statusCode!);
      });
      req.on("error", reject); req.end();
    });
    assert.equal(status, 403);
    const reply = await new Promise<string>((resolve, reject) => {
      const socket = connect(Number(address.port), address.hostname);
      socket.on("connect", () => socket.write("CONNECT 127.0.0.1:80 HTTP/1.1\r\nHost: 127.0.0.1:80\r\n\r\n"));
      socket.on("data", chunk => { resolve(chunk.toString()); socket.destroy(); });
      socket.on("error", reject);
    });
    assert.match(reply, /403 Forbidden/);
  } finally { await proxy.close(); }
});

test("trusted upstream receives pinned literal targets and redirect to private IP is refused", async () => {
  const targets: string[] = [];
  const upstream = createServer();
  upstream.on("connect", (req, socket) => {
    targets.push(req.url!);
    socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    socket.once("data", () => socket.end("HTTP/1.1 302 Found\r\nLocation: http://10.0.0.1/secret\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"));
  });
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const port = (upstream.address() as { port: number }).port;
  const proxy = new EgressProxy("http://127.0.0.1:" + port);
  const address = new URL(await proxy.open());
  const get = (path: string) => new Promise<{ status: number; location?: string }>((resolve, reject) => {
    const req = request({ hostname: address.hostname, port: address.port, path }, response => {
      response.resume(); resolve({ status: response.statusCode!, location: response.headers.location });
    });
    req.on("error", reject); req.end();
  });
  try {
    const first = await get("http://8.8.8.8/article");
    assert.equal(first.status, 302);
    assert.equal(first.location, "http://10.0.0.1/secret");
    assert.deepEqual(targets, ["8.8.8.8:80"]);
    assert.equal((await get(first.location!)).status, 403);
    assert.equal(targets.length, 1);
  } finally {
    await proxy.close();
    await new Promise<void>(resolve => upstream.close(() => resolve()));
  }
});
