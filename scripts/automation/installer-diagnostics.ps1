param([int]$InstallerPid, [string]$EvidenceDirectory)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $EvidenceDirectory | Out-Null
$processes = @(Get-CimInstance Win32_Process)
$owned = [System.Collections.Generic.HashSet[int]]::new()
$null = $owned.Add($InstallerPid)
do {
  $added = $false
  foreach ($process in $processes) {
    if ($owned.Contains([int]$process.ParentProcessId) -and $owned.Add([int]$process.ProcessId)) {
      $added = $true
    }
  }
} while ($added)
$details = @($processes | Where-Object { $owned.Contains([int]$_.ProcessId) } |
  Select-Object ProcessId, ParentProcessId, Name, ExecutablePath)
$details | ConvertTo-Json -Depth 3 | Set-Content -Path (Join-Path $EvidenceDirectory 'windows-installer-processes.json')
$details | Format-Table -AutoSize | Out-String | Write-Output
# Capture only the disposable Actions desktop, never a manual tester's desktop.
if ($env:GITHUB_ACTIONS -eq 'true' -and $env:RUNNER_OS -eq 'Windows') {
  try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bitmap = [System.Drawing.Bitmap]::new($bounds.Width, $bounds.Height)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try { $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size) }
      finally { $graphics.Dispose() }
      $bitmap.Save((Join-Path $EvidenceDirectory 'windows-installer-timeout.png'))
    } finally { $bitmap.Dispose() }
  } catch { Write-Output 'Installer desktop capture unavailable.' }
}
