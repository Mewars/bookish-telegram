# Ryadom: offline, read-only inspection of the local PostgreSQL backup.
# Does not contact Supabase, start databases, copy user records or restore data.
# This is NOT a full restore test; it checks the entire compressed archive stream.
[CmdletBinding()]
param(
  [string]$BackupDirectory = "",
  [string]$BackupFile = ""
)

$ErrorActionPreference = "Stop"

$tool = Join-Path $env:ProgramFiles "PostgreSQL\17\bin\pg_restore.exe"
if (-not (Test-Path -LiteralPath $tool -PathType Leaf)) {
  $command = Get-Command pg_restore.exe -ErrorAction SilentlyContinue
  if ($null -eq $command) {
    throw "pg_restore.exe was not found. PostgreSQL 17 command-line tools are required."
  }
  $tool = $command.Source
}
if ([string]::IsNullOrWhiteSpace($BackupDirectory)) {
  $documents = [Environment]::GetFolderPath('MyDocuments')
  if ([string]::IsNullOrWhiteSpace($documents)) {
    $documents = Join-Path $env:USERPROFILE 'Documents'
  }
  $BackupDirectory = Join-Path $documents 'Ryadom-Private-Backups'
}
if ([string]::IsNullOrWhiteSpace($BackupFile)) {
  if (-not (Test-Path -LiteralPath $BackupDirectory -PathType Container)) {
    throw "Backup folder does not exist. No changes made."
  }
  $archives = @(Get-ChildItem -LiteralPath $BackupDirectory -Filter 'ryadom-supabase-*.backup' -File |
    Sort-Object LastWriteTimeUtc -Descending)
  if ($archives.Count -eq 0) { throw "No finished .backup archive found. No changes made." }
  $BackupFile = $archives[0].FullName
}
if (-not (Test-Path -LiteralPath $BackupFile -PathType Leaf) -or
    [IO.Path]::GetExtension($BackupFile) -ne '.backup') {
  throw "Select a completed .backup file, not a partial or SQL export."
}
$archive = (Resolve-Path -LiteralPath $BackupFile).Path
$hashPath = $archive + '.sha256.txt'
Write-Host "Ryadom backup offline check" -ForegroundColor Cyan
Write-Host ("Archive: " + [IO.Path]::GetFileName($archive))
Write-Host "No database credentials or network access are required."

if (-not (Test-Path -LiteralPath $hashPath -PathType Leaf)) {
  throw "SHA256 file is missing. Cannot verify this archive with the original checksum."
}
$expected = (Get-Content -LiteralPath $hashPath -Raw).Trim()
if ($expected -notmatch '^[a-fA-F0-9]{64}$') {
  throw "Original checksum file has the wrong format."
}
$actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash
if ($actual -ine $expected) {
  throw "SHA256 MISMATCH. Do not rely on this archive."
}
Write-Host "SHA256: OK" -ForegroundColor Green

$items = & $tool '--list' $archive
if ($LASTEXITCODE -ne 0 -or -not $items) {
  throw "The archive table-of-contents cannot be read."
}
$text = $items -join [Environment]::NewLine
if ($text -notmatch '\bTABLE DATA auth users\b' -or
    $text -notmatch '\bTABLE DATA public profiles\b') {
  throw "Missing critical auth.users or public.profiles table data entries."
}
Write-Host "Auth and profiles entries: OK" -ForegroundColor Green

# Discard output through the Windows NUL device: sensitive SQL is never
# written to a plaintext file or printed in the terminal.
# This forces pg_restore to decompress/read the full archive body, not only TOC.
& $tool '--file=NUL' '--no-owner' '--no-acl' $archive 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "FULL ARCHIVE READ FAILED. Backup may be damaged or incomplete."
}
Write-Host "Full archive decompression/read: OK" -ForegroundColor Green
Write-Host ""
Write-Host "BACKUP FILE INTEGRITY: PASSED" -ForegroundColor Green
Write-Host "ACTUAL DATABASE RESTORE: NOT TESTED" -ForegroundColor Yellow
Write-Host "Do not upload this archive to ChatGPT, GitHub, or a public website."
Write-Host "Keep the private backup and SHA256 file together in an encrypted offline copy."
