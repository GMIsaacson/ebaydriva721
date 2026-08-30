# Work Control v1 — Authenticated Remote Owner Access

Status: **CONTROLLED INTERNAL LIVE + AUTHENTICATED HTTPS EDGE**

## Live owner endpoint

`https://workcontrol.159-65-169-244.sslip.io/`

Authentication is HTTP Basic Authentication over TLS with one dedicated owner account. The live username is `factory-owner`; the real password and real password hash are intentionally not stored in Git.

## Architecture

```text
Owner browser
  -> HTTPS / TLS (Caddy)
  -> HTTP Basic Authentication (Argon2id password hash)
  -> private Docker edge network
  -> factory-work-control-v1:8787
  -> governed worker queue / receipts
```

The worker container is not attached to the edge network and exposes no host port.

## Runtime controls

- Caddy version at activation: `v2.11.4`.
- TLS certificate: Let's Encrypt, automatically managed by Caddy.
- DNS: `sslip.io` IP-derived hostname resolving to Factory1 public IPv4.
- Public host ports: 80/tcp (ACME + HTTPS redirect), 443/tcp and 443/udp.
- Work Control remains additionally bound to `127.0.0.1:8787` on the host.
- Unauthenticated application/API requests return `401`.
- Authenticated `/` returns the Work Control UI.
- Authenticated `/api/v1/health` reported `GOVERNED_WORKER`, worker online, 13 registered run records.
- Security response headers include HSTS, CSP, frame denial, MIME-sniff protection, no-referrer and noindex/noarchive.

## Credential handling

The owner password was generated once, transferred through a one-time server file channel, converted to an Argon2id hash with Caddy, and the plaintext staging file was immediately removed. Only the hash remains in the server-local Caddy configuration. The password itself is not committed to Git.

Changing the password means generating a new owner password/hash and atomically reloading/recreating the edge container; it does not require changing Work Control or the worker.

## Isolation

`factory-work-control-edge-v1` is attached only to `work-control-edge-net`. `factory-work-control-v1` is attached to both the existing worker-side network and the edge network. `factory-work-control-worker-v1` remains on the worker-side network only and has no public listener.

The remote-access layer does not change team authority ceilings. New assignments still start with zero external actions, zero external spend, no deploy/publish/message/destructive/production mutation authority, and the existing model-compute budget controls remain in force.

## Recovery

Removing `factory-work-control-edge-v1` and disconnecting `work-control-edge-net` removes remote access without modifying the Work Control ledger or governed worker. Factory v0.1 remains preserved separately at the frozen recovery baseline.
