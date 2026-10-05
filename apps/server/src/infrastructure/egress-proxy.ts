import { Agent, createServer, request, type Server, type IncomingHttpHeaders } from "node:http";
import { connect, type Socket } from "node:net";
import { connect as tlsConnect } from "node:tls";
import { validatePublicUrl } from "./url-security.js";

// Browser DNS checks alone race with Chromium's independent resolver. This
// loopback proxy connects to the exact validated IP, including CONNECT tunnels.
export class EgressProxy {
  private server?: Server;
  private address?: string;
  private opening?: Promise<string>;
  private readonly sockets = new Set<Socket>();

  constructor(private readonly upstream?: string) {}

  open(): Promise<string> {
    if (this.address) return Promise.resolve(this.address);
    return this.opening ??= this.listen();
  }

  async close(): Promise<void> {
    for (const socket of this.sockets) socket.destroy();
    if (this.server) await new Promise<void>(resolve => this.server!.close(() => resolve()));
    this.server = undefined;
    this.address = undefined;
    this.opening = undefined;
  }

  private async tunnel(host: string, port: number): Promise<Socket> {
    if (!this.upstream) {
      return new Promise((resolve, reject) => {
        const socket = connect({ host, port });
        this.track(socket);
        socket.once("connect", () => resolve(socket));
        socket.once("error", reject);
        socket.once("close", () => reject(new Error("Connection closed")));
        socket.setTimeout(30000, () => socket.destroy(new Error("Connection timeout")));
      });
    }
    // The configured proxy is trusted infrastructure. Send a validated literal
    // target IP so its resolver cannot rebind an article hostname.
    const proxy = new URL(this.upstream);
    if (!["http:", "https:"].includes(proxy.protocol)) throw new Error("Proxy must use HTTP or HTTPS");
    return new Promise((resolve, reject) => {
      const options = { host: proxy.hostname, port: Number(proxy.port || (proxy.protocol === "https:" ? 443 : 80)) };
      const socket = proxy.protocol === "https:" ? tlsConnect(options) : connect(options);
      this.track(socket);
      const ready = proxy.protocol === "https:" ? "secureConnect" : "connect";
      const target = host.includes(":") ? `[${host}]:${port}` : `${host}:${port}`;
      socket.once(ready, () => {
        const auth = proxy.username
          ? `Proxy-Authorization: Basic ${Buffer.from(decodeURIComponent(proxy.username) + ":" + decodeURIComponent(proxy.password)).toString("base64")}\r\n`
          : "";
        socket.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n${auth}\r\n`);
      });
      let header = Buffer.alloc(0);
      const receive = (chunk: Buffer) => {
        header = Buffer.concat([header, chunk]);
        const end = header.indexOf("\r\n\r\n");
        if (end < 0) {
          if (header.length > 16384) socket.destroy(new Error("Proxy header too large"));
          return;
        }
        socket.off("data", receive);
        if (!/^HTTP\/1\.[01] 200\b/.test(header.toString())) {
          socket.destroy(new Error("Upstream proxy rejected CONNECT"));
          return;
        }
        const remaining = header.subarray(end + 4);
        if (remaining.length) socket.unshift(remaining);
        resolve(socket);
      };
      socket.on("data", receive);
      socket.once("error", reject);
      socket.once("close", () => reject(new Error("Upstream proxy closed")));
      socket.setTimeout(30000, () => socket.destroy(new Error("Proxy timeout")));
    });
  }

  private async listen(): Promise<string> {
    const server = createServer(async (incoming, outgoing) => {
      try {
        const target = await validatePublicUrl(incoming.url ?? "");
        const socket = await this.tunnel(target.address, Number(target.url.port || 80));
        const headers: IncomingHttpHeaders = { ...incoming.headers, host: target.url.host };
        delete headers["proxy-authorization"];
        delete headers["proxy-connection"];
        const agent = new Agent();
        agent.createConnection = () => socket;
        const forwarded = request({
          hostname: target.address, port: Number(target.url.port || 80),
          path: target.url.pathname + target.url.search,
          method: incoming.method, headers, agent,
        }, response => {
          outgoing.writeHead(response.statusCode ?? 502, response.headers);
          response.on("error", () => outgoing.destroy());
          response.pipe(outgoing);
        });
        forwarded.on("error", () => { outgoing.destroy(); socket.destroy(); });
        incoming.on("aborted", () => forwarded.destroy());
        incoming.pipe(forwarded);
      } catch { outgoing.writeHead(403); outgoing.end("Blocked non-public destination"); }
    });
    server.on("connect", async (incoming, client, head) => {
      try {
        const target = await validatePublicUrl(`https://${incoming.url}/`);
        const socket = await this.tunnel(target.address, Number(target.url.port || 443));
        if (client.destroyed) { socket.destroy(); return; }
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) socket.write(head);
        socket.pipe(client);
        client.pipe(socket);
        client.on("close", () => socket.destroy());
        socket.on("error", () => client.destroy());
      } catch { client.end("HTTP/1.1 403 Forbidden\r\n\r\n"); }
    });
    server.on("connection", socket => this.track(socket));
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Proxy did not start");
    return this.address = `http://127.0.0.1:${address.port}`;
  }

  private track(socket: Socket): void {
    this.sockets.add(socket);
    socket.on("error", () => socket.destroy());
    socket.on("close", () => this.sockets.delete(socket));
  }
}
