## Information Security Policy (Starter)

**Organization**: [Your Company / Your Name]  
**System**: Budgeting Dashboard (web application)  
**Last updated**: [YYYY-MM-DD]  
**Security contact**: [Name, Title, Email] (or group email like `security@yourdomain.com`)

### 1) Purpose
This policy defines the security practices used to protect customer data and the systems that store, process, or transmit it.

### 2) Scope
Applies to:
- Application code and repositories
- Production infrastructure (hosting, database, logs)
- Developer/admin accounts (GitHub, hosting, database, Plaid, etc.)
- Third‑party vendors that process data on our behalf

### 3) Roles and responsibilities
- **Security owner**: [Name/Role] — accountable for the security program and risk decisions.
- **Administrators**: [Name/Role] — manage production access, secrets, and deployments.
- **Developers**: [Name/Role] — follow secure development practices and remediate issues.

### 4) Access control
We use least privilege and restrict access to production systems and sensitive data.

Controls (mark what is true):
- [ ] Unique accounts (no shared logins) for all admin systems
- [ ] Role-based access control / least privilege
- [ ] Access reviewed periodically (e.g., quarterly)
- [ ] Administrative actions logged (provider logs or app logs)

### 5) Authentication and MFA (admin access)
Controls:
- [ ] MFA enabled for GitHub
- [ ] MFA enabled for hosting provider (e.g., Render)
- [ ] MFA enabled for database provider (e.g., Supabase)
- [ ] MFA enabled for Plaid Dashboard

### 6) Data protection
#### 6.1 Encryption in transit
All external traffic uses TLS 1.2+ (HTTPS). We do not transmit secrets over plaintext channels.

#### 6.2 Encryption at rest
We rely on encryption-at-rest controls provided by managed vendors where applicable and protect secrets using environment variables and access controls.

Controls:
- [ ] Secrets stored in environment variables / secret manager (not committed to git)
- [ ] Data stored in managed services with encryption at rest enabled by provider
- [ ] Backups protected by provider controls

### 7) Secret management
Secrets (API keys, tokens, DB credentials) must not be committed to source control.

Controls:
- [ ] `.env` / `.env.local` files are ignored and not committed
- [ ] Secrets are rotated when exposure is suspected/confirmed
- [ ] Production secrets are scoped and separated from development/sandbox

### 8) Secure development
We aim to reduce vulnerabilities during development and deployment.

Controls:
- [ ] Code changes are reviewed before deployment (self-review acceptable for solo dev)
- [ ] Dependencies are kept up to date (periodic review)
- [ ] Security issues are tracked and remediated in a timely manner

### 9) Vulnerability management
Controls (mark what is true):
- [ ] Dependency scanning (e.g., `npm audit`, Dependabot, provider alerts)
- [ ] Periodic vulnerability review cadence: [weekly/monthly]
- [ ] Critical vulnerabilities remediated within: [X days]

### 10) Logging and monitoring
We maintain logs to support troubleshooting and security investigations.

Controls:
- [ ] Hosting provider logs retained for at least: [X days]
- [ ] Access logs available for production endpoints
- [ ] Alerts for critical availability issues (optional)

### 11) Incident response
If we suspect unauthorized access or data exposure, we will:
- Contain and mitigate the issue
- Rotate affected credentials/secrets
- Review logs to understand scope and timeline
- Notify impacted users and vendors as required
- Document the incident and remediation actions

### 12) Data retention and deletion
We define how long we retain data and how users can request deletion.

- **Retention**: [Describe what is stored and for how long]
- **Deletion**: [Describe how users request deletion and how it’s executed]

### 13) Third‑party risk
We use third-party providers (e.g., hosting, database, Plaid) and evaluate them based on:
- Security controls and access management
- Encryption in transit and at rest
- Data processing scope and contractual terms

### 14) Review cadence
This policy is reviewed at least [annually/quarterly] or after major system changes.


