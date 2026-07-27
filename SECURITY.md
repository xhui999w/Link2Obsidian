# Security Policy

## Current deployment boundary

The current MVP does not enforce `L2O_API_TOKEN`. Do not expose the HTTP port
directly to the public internet. Use a trusted LAN or VPN.

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

