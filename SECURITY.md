# Security Policy

## Supported Version

Security fixes are evaluated for the latest v1.3.x release. Older snapshots may not receive fixes.

## Reporting A Vulnerability

Do not include exploit details, credentials, tokens, private paths, or personal data in a public GitHub Issue.

Before the repository is made public, the owner must choose and enable a private reporting channel. The recommended option is GitHub Private Vulnerability Reporting through the repository's Security settings. If that option is not enabled, the owner must publish a dedicated private security contact before launch.

Please include the affected version, a concise reproduction, impact, and any suggested mitigation. Avoid accessing data that does not belong to you.

## Scope Notes

Life Launcher is a local-first Windows desktop application. Registered apps, files, folders, URLs, instruction folders, session records, and notes are user-controlled local inputs. URL favicon retrieval is network-facing and is intentionally bounded by destination validation, redirect limits, timeouts, response-size limits, content-type checks, and image decoding checks.