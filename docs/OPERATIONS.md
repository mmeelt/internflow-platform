# Operations and recovery

## Local preflight

After starting Docker Compose, run this from the project root:

```powershell
.\scripts\verify-local.ps1
```

It only reads service status, health endpoints, and backup file names. It does not change the database or uploads.

## Backups

The `backup` service runs daily at `BACKUP_CRON` and creates two timestamped files in the private `backup_data` volume:

- `postgres/*.sql.gz` — PostgreSQL database dump
- `uploads/*.tar.gz` — submitted documents and project assets

Keep matching files together. Before public deployment, export both sets to encrypted off-site storage with access limited to the enterprise operations team.

## Safe restore rehearsal

Do not restore over the live application. First stop the application and restore into a separate, empty staging PostgreSQL database and empty upload directory. Verify that administrators can sign in, project files open, and document metadata matches the restored files. Only an authorized enterprise administrator should perform a live restore.

## Production handover

Before enterprise hosting, the server administrator must provide the domain/DNS configuration, HTTPS access, off-site backup destination, secret store, and monitoring/alerting account. The application already exposes `/actuator/health` for an uptime monitor.
