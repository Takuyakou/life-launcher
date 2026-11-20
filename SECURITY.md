# Security Policy

## Supported Version

Security fixes are evaluated for the latest release on the GitHub Releases page. Older releases may not receive fixes.

## Reporting A Vulnerability

Do not include exploit details, credentials, tokens, private paths, or personal data in a public GitHub Issue.

Please report vulnerabilities privately through GitHub Private Vulnerability Reporting: open the repository's Security tab and choose "Report a vulnerability".

Please include the affected version, a concise reproduction, impact, and any suggested mitigation. Avoid accessing data that does not belong to you.

## Scope Notes

Life Launcher is a local-first Windows desktop application. Registered apps, files, folders, URLs, instruction folders, session records, and notes are user-controlled local inputs. URL favicon retrieval is network-facing and is intentionally bounded by destination validation, redirect limits, timeouts, response-size limits, content-type checks, and image decoding checks. Life Launcher opens the apps, files, folders, and URLs that the user registers. Do not import JSON from an untrusted source. The import shows a preview before applying it. Right after an import, it can be undone from the notification, as long as nothing else has changed since.

## Development Secrets

AIツールの設定ファイルは Git に入れない。秘密の情報を含むコマンドは、常に許可しない。