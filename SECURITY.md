# Security Guidance

This project can be run locally with minimal friction, but **public deployment requires additional controls**.

## Current hardening in the repo

The backend now includes:

- filename sanitization for uploads
- upload size limits
- extension allowlisting for workbook uploads
- trusted-host middleware
- configurable CORS origins
- rate limiting for high-cost endpoints
- response security headers for API traffic
- prompt-injection blocking for chat requests

## Public deployment requirements

Before exposing CalcSense publicly, add:

1. Real authentication and authorization
- The current app does not have end-user auth.
- Do not expose workbook upload/edit/download APIs publicly without auth.
- Put the backend behind real user authentication, not just a shared browser token.

2. Durable storage isolation
- Store uploads in object storage, not local ephemeral disk.
- Keep workbook files and generated caches outside any public web root.

3. Malware and content scanning
- Scan uploaded workbooks before processing.
- Treat uploaded files as untrusted content.

4. Centralized logging and monitoring
- Log uploads, edits, chart insertions, downloads, auth failures, and rate-limit events.
- Avoid logging secrets, access tokens, or raw workbook content unless legally and operationally required.

5. HTTPS everywhere
- Serve both frontend and backend only over HTTPS.
- Add HSTS at the edge once certificates and hostnames are stable.

6. Abuse controls
- Keep rate limiting in place.
- Add bot protection or WAF rules at the edge for public traffic.
- Restrict management and admin interfaces.

## Recommended security backlog

- Add end-user auth
- Add role-based access control per workbook
- Move uploads to object storage
- Add antivirus scanning for uploads
- Add audit logging for workbook mutations
- Add CSRF protections if cookie-based auth is introduced
- Add dependency scanning in CI
- Add SAST/secret scanning in CI
- Add backup and deletion policies for uploaded files

## MCP server guidance

If you use the bundled MCP server:

- prefer local `stdio` transport
- point it only at trusted CalcSense backends
- do not grant it access to untrusted remote MCP hosts
- review tool outputs because prompt injection can occur through tool-returned content

Relevant references:

- [OWASP MCP Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
