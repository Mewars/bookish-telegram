# Ryadom Supabase local PostgreSQL dump helper.
# Never upload the resulting .backup or database password to GitHub, chat, or a public folder.
# Use connection details from Supabase Dashboard > Connect > Session pooler.
[CmdletBinding()]
param(
    [string]$DbHost = "",
    [ValidateRange(1, 65535)]
    [int]$DbPort = 5432,
    [string]$DbUser = "",
    [string]$DbName = "postgres",
    [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"
$projectRef = "cptbmepnbzogqkfhflsg"
$bin = Join-Path $env:ProgramFiles "PostgreSQL\17\bin"
$dumpTool = Join-Path $bin "pg_dump.exe"
$restoreTool = Join-Path $bin "pg_restore.exe"
if (-not (Test-Path -LiteralPath $dumpTool -PathType Leaf)) {
    throw "PostgreSQL 17 pg_dump.exe not found: $dumpTool"
}
if (-not (Test-Path -LiteralPath $restoreTool -PathType Leaf)) {
    throw "PostgreSQL 17 pg_restore.exe not found: $restoreTool"
}

Write-Host "Ryadom project reference: $projectRef"
Write-Host "Use the SESSION POOLER details shown in Supabase Dashboard > Connect."
Write-Host "The database password will not be printed."
if ([string]::IsNullOrWhiteSpace($DbHost)) {
    $DbHost = Read-Host "Session pooler host (without postgresql://)"
}
if ([string]::IsNullOrWhiteSpace($DbUser)) {
    $DbUser = Read-Host "Database user (usually postgres.$projectRef)"
}
$DbHost = $DbHost.Trim()
$DbUser = $DbUser.Trim()
if ($DbHost -notmatch '^[A-Za-z0-9][A-Za-z0-9.-]*$' -or $DbUser -notmatch '^[A-Za-z0-9_.-]+$') {
    throw "Invalid connection details. Copy them from Supabase Dashboard > Connect."
}
# A shared session-pooler hostname cannot prove tenant identity: check the user suffix.
if ($DbHost -notlike "*$projectRef*" -and $DbUser -notlike "*$projectRef*") {
    throw "This connection does not appear to be the Ryadom project."
}
if ($DbName -ne 'postgres') {
    throw "Expected the postgres database for Ryadom."
}
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $documents = [Environment]::GetFolderPath('MyDocuments')
    if ([string]::IsNullOrWhiteSpace($documents)) {
        $documents = Join-Path $env:USERPROFILE 'Documents'
    }
    $OutputDirectory = Join-Path $documents 'Ryadom-Private-Backups'
}
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$finalFile = Join-Path $OutputDirectory ("ryadom-supabase-" + $stamp + ".backup")
$tempFile = $finalFile + ".partial"
$password = Read-Host "Supabase database password (hidden input)" -AsSecureString
$bstr = [IntPtr]::Zero
$priorSslMode = [Environment]::GetEnvironmentVariable('PGSSLMODE', 'Process')
try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $env:PGSSLMODE = "require"
    Write-Host "Starting a READ-ONLY pg_dump. This may take several minutes..."
    & $dumpTool '--format=custom' '--no-owner' '--no-acl' '--host' $DbHost '--port' ([string]$DbPort) '--username' $DbUser '--dbname' $DbName '--file' $tempFile
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed. No finished backup was saved. Check host, user, password and network."
    }
}
finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    [Environment]::SetEnvironmentVariable('PGSSLMODE', $priorSslMode, 'Process')
    if ($bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    $password = $null
}
$listing = & $restoreTool '--list' $tempFile
if ($LASTEXITCODE -ne 0 -or -not $listing) {
    throw "Backup verification failed. An unfinished .partial file remains."
}
$listingText = $listing -join [Environment]::NewLine
if ($listingText -notmatch '\bTABLE\s+DATA\s+auth\s+users\b' -or
    $listingText -notmatch '\bTABLE\s+DATA\s+public\s+profiles\b') {
    throw "Backup does not list auth.users and public.profiles. Do not treat it as complete."
}
Move-Item -LiteralPath $tempFile -Destination $finalFile
$checksumFile = $finalFile + '.sha256.txt'
Set-Content -LiteralPath $checksumFile -Value (Get-FileHash -Algorithm SHA256 -LiteralPath $finalFile).Hash -Encoding ASCII
Write-Host "Backup completed and checked!" -ForegroundColor Green
Write-Host "PRIVATE BACKUP: $finalFile"
Write-Host "SHA256 CHECKSUM: $checksumFile"
Write-Host "Never share this backup or upload it to a public repository."
Write-Host "Keep an encrypted offline copy. Restoration must be separately tested."
