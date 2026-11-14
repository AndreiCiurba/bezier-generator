# Registers (or replaces) a Windows scheduled task that runs run-daily.ps1 at
# the given time(s) every day, as you, while you are logged in - it needs your
# Claude Code sign-in and the machine's GPU, so it cannot run as a background
# service. If the PC was off or asleep at the scheduled time, it runs at the
# next opportunity.
#
#     powershell -ExecutionPolicy Bypass -File tools\reel-pipeline\schedule\register-daily-task.ps1 -At 07:00
#     powershell -ExecutionPolicy Bypass -File tools\reel-pipeline\schedule\register-daily-task.ps1 -At 07:00,13:00,19:00
#
# To stop it:  Unregister-ScheduledTask -TaskName StringArtReels-DailyBatch -Confirm:$false
param(
  [string[]]$At = @('07:00'),
  [string]$TaskName = 'StringArtReels-DailyBatch'
)

$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'run-daily.ps1'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -OpenWhenDone"
$triggers = $At | ForEach-Object { New-ScheduledTaskTrigger -Daily -At $_ }
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 3)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers -Settings $settings -Force `
  -Description 'Generates the day''s batch of candidate string-art reels (tools/reel-pipeline).' | Out-Null

Write-Output "Registered '$TaskName' to run daily at $($At -join ', ')."
Write-Output "Each run writes tools\reel-pipeline\batches\<date>\index.html and opens it when ready."
