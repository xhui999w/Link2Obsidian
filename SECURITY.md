# Security Policy

## Current deployment boundary

V0.2 enforces `L2O_API_TOKEN` on all `/api/*` routes when configured.
Docker Compose requires a token; choose a long random value. Empty-token
standalone processes preserve trusted-network compatibility. Use HTTPS for
remote access. Tokens are not stored persistently by the dashboard.

User page and image URLs must use HTTP/HTTPS and resolve only to public IPs.
The local egress proxy connects to the validated IP, including browser
subresources and HTTPS CONNECT tunnels. Redirect destinations and final page
URLs are checked. Local, private, link-local, multicast, mapped/transition and
special-purpose ranges are blocked. Upstream proxies must support CONNECT to
literal IPs. Administrator-configured proxy and AI endpoints are trusted
configuration and may be on the LAN.

Run one instance per data directory. The service uses a writable SQLite
metadata database and a Vault mount; do not mount unrelated sensitive paths.

The service loads user-submitted URLs and writes files into a mounted Obsidian
Vault. Review volume paths carefully and keep regular Vault backups.

When a cloud AI provider is enabled, the article title, source, and part of the
article text are sent to that provider. Never publish `L2O_AI_API_KEY`.

## Reporting a vulnerability

Please do not open a public issue containing an exploitable vulnerability,
private URL, token, cookie, or API key. Use GitHub's private vulnerability
reporting feature when it is enabled for the repository. Otherwise contact the
maintainer privately through the repository owner's published contact method.

Include the affected version, impact, reproduction conditions, and a proposed
mitigation if available.
