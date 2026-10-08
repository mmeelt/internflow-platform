$ErrorActionPreference = "Stop"

Write-Host "Checking Intern Portal services..."
docker compose ps

$backend = Invoke-RestMethod "http://localhost:8081/actuator/health"
if ($backend.status -ne "UP") { throw "Backend health check failed." }

$frontend = Invoke-WebRequest "http://localhost:3000/login" -UseBasicParsing
if ($frontend.StatusCode -ne 200) { throw "Frontend health check failed." }

$backupFiles = docker compose exec -T backup sh -c "ls /backups/postgres/*.sql.gz /backups/uploads/*.tar.gz 2>/dev/null"
if (-not $backupFiles) { throw "No database and upload backup files were found." }

Write-Host "All local checks passed: frontend, backend, and protected backups are available." -ForegroundColor Green
