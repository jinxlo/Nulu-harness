# Observe only the disposable qualification process and its private installation directories.
$ErrorActionPreference = 'Stop'
$evidence = Join-Path (Get-Location) 'probe-evidence'
New-Item -ItemType Directory -Force $evidence | Out-Null
Add-Type @'
using System;
using System.Collections.Generic;
using System.Text;
using System.Runtime.InteropServices;
public class InstallerProbe {
  public delegate bool Callback(IntPtr hwnd, IntPtr state);
  [DllImport("user32.dll")] static extern bool EnumWindows(Callback cb, IntPtr state);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr hwnd, Callback cb, IntPtr state);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int max);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder text, int max);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("dbghelp.dll", SetLastError=true)] public static extern bool MiniDumpWriteDump(IntPtr process, uint pid, IntPtr file, uint kind, IntPtr exception, IntPtr user, IntPtr callback);
  public static string[] Windows(uint pid) {
    var lines = new List<string>();
    Callback child = (h, s) => {
      var text = new StringBuilder(2048); var cls = new StringBuilder(256);
      GetWindowText(h, text, text.Capacity); GetClassName(h, cls, cls.Capacity);
      lines.Add(h.ToString("x") + " visible=" + IsWindowVisible(h) + " " + cls + " " + text);
      return true;
    };
    EnumWindows((h, s) => { uint owner; GetWindowThreadProcessId(h, out owner);
      if (owner == pid) { child(h, s); EnumChildWindows(h, child, IntPtr.Zero); } return true;
    }, IntPtr.Zero);
    return lines.ToArray();
  }
}
'@
$assets = 'failed-candidate/apps/desktop/.desktop-build/targets/win-x64/unsigned-artifacts'
$started = Get-Date
$node = Start-Process node -ArgumentList @('scripts/automation/install-smoke.mjs', $assets, 'previous', 'win-x64', 'probe-evidence') -PassThru -NoNewWindow -RedirectStandardOutput "$evidence/stdout.log" -RedirectStandardError "$evidence/stderr.log"
$dumped = [System.Collections.Generic.HashSet[int]]::new()
try {
  for ($sample = 0; -not $node.HasExited -and $sample -lt 24; $sample++) {
    $all = @(Get-CimInstance Win32_Process)
    $owned = [System.Collections.Generic.HashSet[int]]::new()
    $null = $owned.Add($node.Id)
    do {
      $added = $false
      foreach ($item in $all) {
        if ($owned.Contains([int]$item.ParentProcessId) -and $owned.Add([int]$item.ProcessId)) { $added = $true }
      }
    } while ($added)
    $details = @()
    foreach ($item in $all | Where-Object { $owned.Contains([int]$_.ProcessId) }) {
      $native = Get-Process -Id $item.ProcessId -ErrorAction SilentlyContinue
      $details += [ordered]@{ pid=$item.ProcessId; parent=$item.ParentProcessId; path=$item.ExecutablePath; cpu=$native.CPU; handles=$native.HandleCount; threads=$native.Threads.Count; windows=@([InstallerProbe]::Windows($item.ProcessId)) }
      if ($sample -ge 8 -and $item.Name -eq 'nulu-harness-1.6.1-win-x64.exe' -and $dumped.Add([int]$item.ProcessId)) {
        $file = [System.IO.File]::Create("$evidence/installer-$($item.ProcessId).dmp")
        try {
          $ok = [InstallerProbe]::MiniDumpWriteDump($native.Handle, $item.ProcessId, $file.SafeFileHandle.DangerousGetHandle(), 0, [IntPtr]::Zero, [IntPtr]::Zero, [IntPtr]::Zero)
          Write-Output "Installer minidump captured: $ok"
        } finally { $file.Dispose() }
      }
    }
    $roots = @(Get-ChildItem $env:TEMP -Directory -Filter 'nulu-install-smoke-*' | Where-Object { $_.CreationTime -ge $started.AddSeconds(-1) })
    $files = @($roots | Get-ChildItem -File -Recurse -ErrorAction SilentlyContinue)
    $state = [ordered]@{ elapsedSeconds=((Get-Date)-$started).TotalSeconds; processes=$details; files=$files.Count; bytes=($files | Measure-Object Length -Sum).Sum; recent=@($files | Sort-Object LastWriteTime -Descending | Select-Object -First 8 FullName,Length,LastWriteTime) }
    $state | ConvertTo-Json -Depth 8 | Set-Content "$evidence/sample-$sample.json"
    Write-Output ($state | ConvertTo-Json -Depth 8 -Compress)
    if ($node.WaitForExit(60000)) { break }
    $node.Refresh()
  }
  if (-not $node.HasExited) { throw 'Qualification exceeded the diagnostic deadline' }
  Get-Content "$evidence/stdout.log"
  Get-Content "$evidence/stderr.log"
  if ($node.ExitCode -ne 0) { throw "Native qualification exited $($node.ExitCode)" }
} finally {
  if (-not $node.HasExited) { & taskkill.exe /PID $node.Id /T /F; $node.WaitForExit() }
}
