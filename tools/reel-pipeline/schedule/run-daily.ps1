# Runs the daily reel batch: starts a headless Claude Code session with the
# prompt in agents/daily-batch.md, which drafts, reviews, reworks and renders
# the day's candidates into batches/<batch>/ and writes the review page.
#
# Run it by hand first to see it work:
#     powershell -ExecutionPolicy Bypass -File tools\reel-pipeline\schedule\run-daily.ps1 -OpenWhenDone
# then schedule it with register-daily-task.ps1.
#
# What the session is allowed to do is set by the flags below: read and edit
# files in this repository, and run reels.mjs - nothing else on the command
# line. It is told (in the prompt) to write only inside its own batch folder.
param(
  # Batch folder name. Defaults to today's date; a second run on the same day gets the time added.
  [string]$Batch = '',
  # Open the review page in the default browser when the batch is ready.
  [switch]$OpenWhenDone,
  # Which model runs the batch, and how hard it thinks. Opus 5.5 at medium effort by default.
  [string]$Model = 'claude-opus-5-5',
  [ValidateSet('low', 'medium', 'high', 'xhigh', 'max')]
  [string]$Effort = 'medium'
)

$ErrorActionPreference = 'Stop'
$pipeline = Split-Path -Parent $PSScriptRoot
$repo = (Resolve-Path (Join-Path $pipeline '..\..')).Path
Set-Location $repo

if (-not $Batch) {
  $Batch = Get-Date -Format 'yyyy-MM-dd'
  if (Test-Path (Join-Path $pipeline "batches\$Batch")) { $Batch = Get-Date -Format 'yyyy-MM-dd-HHmm' }
}

$logDir = Join-Path $pipeline 'logs'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir "$Batch.log"

$prompt = (Get-Content (Join-Path $pipeline 'agents\daily-batch.md') -Raw) + "`n`nBatch name: $Batch`n"

# The prompt goes in on stdin: a long multi-line argument does not survive
# the npm command shim on Windows. UTF-8 so nothing in it is mangled.
$OutputEncoding = New-Object System.Text.UTF8Encoding $false

"[$(Get-Date -Format s)] starting batch $Batch (model $Model, effort $Effort)" | Out-File -FilePath $log -Encoding utf8
$prompt | & claude -p `
  --model $Model `
  --effort $Effort `
  --permission-mode acceptEdits `
  --allowedTools 'Read' 'Write' 'Edit' 'Glob' 'Grep' 'Bash(node tools/reel-pipeline/reels.mjs:*)' `
  | Out-File -FilePath $log -Append -Encoding utf8
"[$(Get-Date -Format s)] claude exited with code $LASTEXITCODE" | Out-File -FilePath $log -Append -Encoding utf8

$page = Join-Path $pipeline "batches\$Batch\index.html"
if (Test-Path $page) {
  Write-Output "Review page: $page"
  # The review page is served on localhost so its "Send to Claude" button can
  # start the finishing run itself (see lib/reviewServer.mjs). The server keeps
  # running in the background after this script ends, until 20 idle hours pass.
  $reviewArgs = @("tools\reel-pipeline\reels.mjs", 'review', $Batch, '--model', $Model, '--effort', $Effort)
  if (-not $OpenWhenDone) { $reviewArgs += '--no-open' }
  Start-Process -FilePath 'node' -ArgumentList $reviewArgs -WorkingDirectory $repo -WindowStyle Hidden
} else {
  Write-Output "No review page was produced - see $log"
  exit 1
}
