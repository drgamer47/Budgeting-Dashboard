## Incident Response (Starter)

**System**: Budgeting Dashboard  
**Owner**: [Name/Role]  
**Security contact**: [Email]  
**Last updated**: [YYYY-MM-DD]

### 1) What counts as an incident
- Exposed credentials (Plaid, Supabase, hosting, GitHub)
- Unauthorized access to production systems or data
- Suspicious activity in logs (unexpected admin actions, repeated auth failures)
- Data integrity issues (unexpected deletes/updates)

### 2) Triage and severity
Classify severity based on:
- Whether consumer financial data was accessed/exfiltrated
- Whether production credentials were exposed
- Blast radius (single user vs multi-user)

### 3) Immediate actions (first 60 minutes)
- **Contain**
  - Disable affected accounts / revoke sessions where possible
  - Lock down access (temporary deny by IP / disable deploys if needed)
- **Rotate secrets**
  - Rotate Plaid secrets / keys
  - Rotate Supabase keys if needed (note: rotating anon keys can require client updates)
  - Rotate hosting/GitHub tokens
- **Preserve evidence**
  - Export provider logs (Render, Supabase, Plaid, GitHub)
  - Record timeline and actions taken

### 4) Investigation
- Identify root cause (code bug, leaked secret, compromised account)
- Determine scope (what data, which users, which time window)
- Verify whether data was accessed or only potentially exposed

### 5) Remediation
- Patch the issue
- Add controls to prevent recurrence (MFA, least privilege, secret scanning, alerts)
- Run post-incident validation (tests, access review)

### 6) Notification
- Notify impacted users if required
- Notify vendors/partners as required by their terms
- Document the incident internally (date, scope, remediation, lessons learned)


