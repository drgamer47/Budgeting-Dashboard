## Data Retention & Deletion Policy (Starter)

**System**: Budgeting Dashboard  
**Owner**: [Name/Role]  
**Last updated**: [YYYY-MM-DD]

### 1) What data we collect/process
Depending on enabled features, the application may process:
- Account profile data (email, display name)
- Budget data (budgets, members, categories)
- Transaction data (user-entered transactions; optionally imported transaction records)
- Logs/telemetry from hosting providers (request logs, error logs)

### 2) Where data is stored
- Primary application data: [Supabase/Postgres]
- Hosting logs: [Render logs]
- Source control: [GitHub] (no secrets should be stored)

### 3) Retention periods
Define default retention:
- **User/budget data**: retained until the user deletes their account or requests deletion.
- **Imported transaction data**: retained as part of the user’s budgeting history until deleted by the user or account deletion request.
- **Operational logs**: retained for **[X days]** (provider default or configured duration).

### 4) Deletion and user requests
Users may request deletion by:
- [Emailing support/security contact] at: [email]

Deletion actions:
- Remove/disable the user account and associated identifiers where applicable
- Delete or anonymize user data in the primary database (within **[X days]**)
- Revoke any active sessions/tokens as appropriate

### 5) Backups
Backups may retain data for a limited period based on provider settings. We rely on provider backup retention of **[X days]**.

### 6) Review cadence
This policy is reviewed at least **[annually/quarterly]** and after major system changes.


