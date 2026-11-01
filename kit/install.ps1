# Spine OS Kit - installer (Windows). Works in Windows PowerShell 5.1 and PowerShell 7.
#
# The Windows twin of install.sh: same questions, same rules, same result.
#   - Everything installs INSIDE one folder you choose. Never above it, nowhere else.
#   - Drive roots, your user folder, Windows and Program Files are refused.
#   - A folder that is already a Spine OS vault switches to update mode: your files are never
#     overwritten; a changed kit file lands beside yours as <file>.new-v<version>.
#   - No network, no admin rights, nothing leaves your computer.
# Double-click Install-on-Windows.cmd to run this, or: powershell -ExecutionPolicy Bypass -File install.ps1
# Non-interactive: set $env:SPINEOS_DEST and $env:SPINEOS_MODULES ("documents,casework" or "none").

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

$Src = Split-Path -Parent $MyInvocation.MyCommand.Path
$Src = (Resolve-Path -LiteralPath $Src).ProviderPath
$Utf8 = New-Object System.Text.UTF8Encoding($false)   # UTF-8 without BOM (5.1's -Encoding UTF8 adds one)
$IsWin = ($env:OS -eq 'Windows_NT')
$Sep = [IO.Path]::DirectorySeparatorChar

function Say([string]$t) { Write-Host "  $t" }
function Fail([string]$t) { Write-Host "  X $t" -ForegroundColor Red; exit 1 }
function Ask([string]$q, [string]$def) {
  if ($env:SPINEOS_NONINTERACTIVE -eq '1') { return $def }
  $a = Read-Host "  $q"
  if ([string]::IsNullOrWhiteSpace($a)) { return $def }
  return $a.Trim()
}
function AskYes([string]$q, [string]$def) { return ((Ask $q $def) -match '^[yY]') }
function WriteText([string]$path, [string]$text) { [IO.File]::WriteAllText($path, $text, $Utf8) }
function ReadText([string]$path) { return [IO.File]::ReadAllText($path, $Utf8) }
function SameFile([string]$a, [string]$b) {
  if ((Get-Item -Force -LiteralPath $a).Length -ne (Get-Item -Force -LiteralPath $b).Length) { return $false }
  return ((Get-FileHash -LiteralPath $a -Algorithm SHA256).Hash -eq (Get-FileHash -LiteralPath $b -Algorithm SHA256).Hash)
}

Write-Host ''
Say '+----------------------------------------------+'
Say '|   Spine OS Kit - Starter                      |'
Say '|   Your business on your hard drive.           |'
Say '+----------------------------------------------+'
Write-Host ''
Say 'Everything installs INSIDE one folder (subfolders only) - never above it.'
Write-Host ''

$HomeDir = [Environment]::GetFolderPath('UserProfile')
$Default = Join-Path $HomeDir 'SpineOS'
if ($env:SPINEOS_DEST) { $Dest = $env:SPINEOS_DEST } else { $Dest = Ask "Where should your Spine OS folder live? [$Default]" $Default }

# Expand a leading ~ and trim quotes people paste from Explorer's "Copy as path".
$Dest = $Dest.Trim().Trim('"')
if ($Dest -eq '~') { $Dest = $HomeDir }
elseif ($Dest -match '^~[\\/]') { $Dest = Join-Path $HomeDir $Dest.Substring(2) }
if (-not [IO.Path]::IsPathRooted($Dest)) { Fail "Please give a full folder path, for example $Default" }
if ($Dest -match '(^|[\\/])\.\.([\\/]|$)') { Fail 'The path may not contain ".." parts.' }
$Dest = [IO.Path]::GetFullPath($Dest).TrimEnd('\', '/')
$Leaf = Split-Path -Leaf $Dest
if ([string]::IsNullOrEmpty($Leaf) -or $Leaf -eq '.' -or $Dest -match '^[A-Za-z]:$') { Fail 'Choose a named folder (for example SpineOS), not a drive.' }
if ($IsWin -and $Dest.Length -gt 220) { Fail 'Choose a shorter folder path so Windows apps stay under the 260-character limit.' }

# Refuse exact system and home roots.
$refused = @($HomeDir, [IO.Path]::GetPathRoot($Dest), '/', '/Users', '/home', '/root', '/tmp', '/etc', '/usr', '/var')
if ($IsWin) {
  $sys = $env:SystemDrive; if (-not $sys) { $sys = 'C:' }
  $refused += @("$sys\Users", "$sys\Windows", "$sys\Program Files", "$sys\Program Files (x86)", "$sys\ProgramData")
}
foreach ($bad in $refused) {
  if ($bad -and ($Dest.TrimEnd('\', '/') -ieq $bad.TrimEnd('\', '/'))) { Fail "`"$Dest`" is a system or home folder. Pick a dedicated folder, for example $Default" }
}

if ($Dest -match 'OneDrive') {
  Say '! This folder is inside OneDrive. That works, but edit on one computer at a time'
  Say '  or OneDrive may create "conflicted copy" files. A folder outside OneDrive is simpler.'
}

$Update = Test-Path -LiteralPath (Join-Path $Dest '.spine-os-root')
if ((Test-Path -LiteralPath $Dest) -and -not $Update) {
  $item = Get-Item -LiteralPath $Dest -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { Fail "`"$Dest`" is a link to another folder; choose a real folder." }
  if (@(Get-ChildItem -LiteralPath $Dest -Force).Count -gt 0) {
    Say "! `"$Dest`" already has files in it (and is not a Spine OS folder)."
    Say '  A NEW empty folder keeps things tidy. Your existing files are never overwritten.'
    if (-not (AskYes 'Install into it anyway? [y/N]' 'n')) { Say 'Stopped - nothing written.'; exit 1 }
  }
}
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
$Dest = (Resolve-Path -LiteralPath $Dest).ProviderPath.TrimEnd('\', '/')
$DestPrefix = $Dest + $Sep

# Optional extras, asked in plain English (same five questions as install.sh).
$Modules = @()
if ($null -ne $env:SPINEOS_MODULES) {
  if ($env:SPINEOS_MODULES -ne 'none') { $Modules = @($env:SPINEOS_MODULES -split '[,\s]+' | Where-Object { $_ }) }
} else {
  Write-Host ''
  Say 'A few optional extras. Press Enter to accept the suggestion in [brackets].'
  Write-Host ''
  if (AskYes 'Do you want a tidy place for documents, letters and forms? [Y/n]' 'y') { $Modules += 'documents' }
  if (AskYes 'Do you keep client or case files (for example clinical or social work)? [y/N]' 'n') { $Modules += 'casework' }
  if (AskYes 'Would you like a reminders list your AI can check and turn into calendar alerts? [Y/n]' 'y') { $Modules += 'reminders' }
  if (AskYes 'Would you like email help (your AI drafts, you always press Send)? [y/N]' 'n') { $Modules += 'email' }
  if (AskYes "Add ready-made AI shortcuts (sort my inbox, find a file, what's due)? [Y/n]" 'y') { $Modules += 'skills' }
}

# Removing files (v1.9): one question. Permanent delete is never offered; nothing is deleted for good by default.
# Non-interactive callers set SPINEOS_REMOVALS=archive|trash|ask.
$RemovalsFile = Join-Path (Join-Path $Dest '_config') 'removals.local'
$Removals = ''
if ($env:SPINEOS_REMOVALS) { $Removals = $env:SPINEOS_REMOVALS }
elseif ($Update -and (Test-Path -LiteralPath $RemovalsFile)) {
  $prevMode = @((ReadText $RemovalsFile) -split "`n" | Where-Object { $_ -match '^mode=' }) | Select-Object -First 1
  if ($prevMode) { $Removals = $prevMode.Substring(5).Trim() }   # keep your earlier choice
} else {
  Write-Host ''
  Say 'When you or your AI remove a file, where should it go?'
  Say '  1  An Archive folder inside your vault (suggested)'
  Say "  2  Your computer's Trash / Recycle Bin"
  Say '  3  Ask me each time'
  $ans = Ask 'Nothing is ever deleted for good without three steps. Choose 1, 2 or 3 [1]' '1'
  if ($ans -match '^(2|t)') { $Removals = 'trash' } elseif ($ans -match '^(3|as)') { $Removals = 'ask' } else { $Removals = 'archive' }
}
if (@('archive', 'trash', 'ask') -notcontains $Removals) { $Removals = 'archive' }
$RemovalsLine = @{
  archive = 'Files you remove go to vault/90-ARCHIVE/ (in a dated folder).'
  trash   = "Files you remove go to your computer's Trash (Mac) or Recycle Bin (Windows)."
  ask     = 'Before removing anything, ask me each time: Archive (vault/90-ARCHIVE/) or Trash?'
}[$Removals]

$KV = '?'
$vf = Join-Path $Src 'VERSION'
if (Test-Path -LiteralPath $vf) { $KV = (ReadText $vf).Trim() }
$script:copied = 0; $script:skipped = 0; $script:beside = 0

function Copy-Tree([string]$From, [bool]$IsKitRoot) {
  $fromFull = (Resolve-Path -LiteralPath $From).ProviderPath.TrimEnd('\', '/')
  foreach ($f in Get-ChildItem -LiteralPath $fromFull -Recurse -File -Force) {
    $rel = $f.FullName.Substring($fromFull.Length + 1) -replace '\\', '/'
    $name = Split-Path -Leaf $rel
    if ($name -eq '.DS_Store' -or $name.StartsWith('._')) { continue }
    if ($IsKitRoot) {
      if ($rel -match '^(install\.sh|install\.command|install\.ps1|Install-on-Windows\.cmd|\.spineos-splash\.)') { continue }
      if ($rel -match '^(modules|zenflow|Install Spine-OS\.app)/') { continue }
    }
    if ($rel -match '(^|/)\.\.(/|$)') { Say "! skipped unsafe path: $rel"; $script:skipped++; continue }
    $target = [IO.Path]::GetFullPath((Join-Path $Dest ($rel -replace '/', [string]$Sep)))
    if (-not $target.StartsWith($DestPrefix, [StringComparison]::OrdinalIgnoreCase)) { Say "! skipped escaping path: $rel"; $script:skipped++; continue }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
    if (Test-Path -LiteralPath $target) {
      if ($IsKitRoot -and ($rel -eq 'status-board.json' -or $rel -eq 'status-board.js')) { $script:skipped++; continue }  # your live board, never replaced
      if (SameFile $f.FullName $target) { $script:skipped++ }
      else { Copy-Item -LiteralPath $f.FullName -Destination "$target.new-v$KV" -Force; $script:beside++ }
      continue
    }
    Copy-Item -LiteralPath $f.FullName -Destination $target
    $script:copied++
  }
}

Copy-Tree $Src $true
$installedModules = @()
foreach ($m in $Modules) {
  if (@('documents', 'casework', 'reminders', 'email', 'skills') -notcontains $m) { continue }
  $mdir = Join-Path (Join-Path (Join-Path $Src 'modules') $m) 'files'
  if (Test-Path -LiteralPath $mdir) { Copy-Tree $mdir $false; $installedModules += $m }
}

$now = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
$marker = Join-Path $Dest '.spine-os-root'
if (-not (Test-Path -LiteralPath $marker)) {
  WriteText $marker "spine-os-wiki-root`nversion=$KV`ninstalled_utc=$now`nboundary=$Dest`n"
}
New-Item -ItemType Directory -Force -Path (Join-Path $Dest '_config') | Out-Null
if (-not $Update -or $env:SPINEOS_REMOVALS -or -not (Test-Path -LiteralPath $RemovalsFile)) {
  WriteText $RemovalsFile "# How removing files works in this vault. Change mode to archive, trash or ask.`n# Permanent deletes always need the three steps in vault/20-GOVERNANCE/SOP-removing-files.md.`nmode=$Removals`narchive_folder=vault/90-ARCHIVE`n"
}
if ($installedModules.Count -gt 0) {
  [IO.File]::AppendAllText((Join-Path $Dest '_config/modules.log'), "$now modules=$($installedModules -join ',')`n", $Utf8)
}

# Branding (fresh installs only - on update your own files are yours, untouched).
function Clean([string]$v) { if ($null -eq $v) { return '' }; return ($v -replace '["\\]', '' -replace '[\r\n\t]', ' ') }
$brandName = Clean $env:SPINEOS_BRAND_NAME; if (-not $brandName) { $brandName = 'Spine OS' }
# Update mode: keep the brand chosen at first install (read back from _config/brand.local).
$brandFile = Join-Path $Dest '_config/brand.local'
if ($Update -and -not $env:SPINEOS_BRAND_NAME -and (Test-Path -LiteralPath $brandFile)) {
  $prev = @((ReadText $brandFile) -split "`n" | Where-Object { $_ -match '^name=' }) | Select-Object -First 1
  if ($prev) { $brandName = Clean ($prev.Substring(5).Trim()) }
}
$brandTag = Clean $env:SPINEOS_TAGLINE; if (-not $brandTag) { $brandTag = 'Your business on your hard drive.' }
$brandInd = Clean $env:SPINEOS_INDUSTRY
$hex1 = Clean $env:SPINEOS_PRIMARY_HEX; if (-not $hex1) { $hex1 = '#14b8a6' }
$hex2 = Clean $env:SPINEOS_SECONDARY_HEX; if (-not $hex2) { $hex2 = '#22d3ee' }
if (-not $Update) {
  WriteText (Join-Path $Dest '_config/brand.local') "name=$brandName`ntagline=$brandTag`nindustry=$brandInd`nprimary_colour=$hex1`nsecondary_colour=$hex2`nlogo_path=`n"
  $sbPath = Join-Path $Dest 'status-board.json'
  if (Test-Path -LiteralPath $sbPath) {
    $sb = ReadText $sbPath
    $sb = $sb.Replace('"name": ""', "`"name`": `"$brandName`"").Replace('"tagline": ""', "`"tagline`": `"$brandTag`"")
    $sb = $sb.Replace('"industry": ""', "`"industry`": `"$brandInd`"").Replace('"primary": "#14b8a6"', "`"primary`": `"$hex1`"")
    $sb = $sb.Replace('"secondary": "#22d3ee"', "`"secondary`": `"$hex2`"").TrimEnd() + "`n"
    WriteText $sbPath $sb
    WriteText (Join-Path $Dest 'status-board.js') ("window.__STATUS_BOARD__ = " + $sb.TrimEnd() + ";`n")
    if ((Get-Item -Force -LiteralPath (Join-Path $Dest 'status-board.js')).Length -eq 0) { Fail 'Branding check failed (status-board.js not written).' }
  }
}

# Stamp the real folder path + brand into the AI instructions (update mode: the beside-copy only).
foreach ($md in @('CLAUDE.md', 'MEMORY.md', 'START-WITH-YOUR-AI.md', 'SETUP-GUIDE.md')) {
  $f = Join-Path $Dest $md
  if ($Update) { $f = "$f.new-v$KV" }
  if (-not (Test-Path -LiteralPath $f)) { continue }
  $c = (ReadText $f).Replace('__VAULT_PATH__', $Dest).Replace('__BRAND__', $brandName).Replace('__REMOVALS__', $RemovalsLine)
  WriteText $f $c
  # A stamped beside-copy identical to your live file is not an update - remove it (less noise).
  if ($Update -and (SameFile $f (Join-Path $Dest $md))) { Remove-Item -LiteralPath $f -Force; $script:beside-- }
}

# Confinement self-check: every file we can see is under the chosen folder.
$outside = @(Get-ChildItem -LiteralPath $Dest -Recurse -File -Force | Where-Object { -not $_.FullName.StartsWith($DestPrefix, [StringComparison]::OrdinalIgnoreCase) }).Count
if ($outside -ne 0) { Fail "Confinement check failed ($outside file(s) outside the folder)." }

Write-Host ''
if ($Update) {
  Say 'OK - UPDATE complete. Your existing files were left untouched.'
  Say "New files added: $($script:copied) - unchanged: $($script:skipped) - updated versions placed beside yours: $($script:beside)"
  if ($script:beside -gt 0) { Say "Look for *.new-v$KV files - your AI can help you merge them." }
} else {
  Say "OK - Installed $($script:copied) file(s), all inside: $Dest"
  Say "Branded as: $brandName"
}
if ($installedModules.Count -gt 0) { Say "Optional extras added: $($installedModules -join ', ')" }
$where = @{ archive = 'the Archive folder (vault/90-ARCHIVE)'; trash = 'the Recycle Bin'; ask = 'the Archive or the Recycle Bin (it asks you each time)' }[$Removals]
Say "Removing files: your AI moves them to $where. Nothing is deleted for good unless you type `"permanently delete`" and the file names."
if (Test-Path -LiteralPath (Join-Path $Dest ".claude/settings.json.new-v$KV")) {
  Say "Your own .claude/settings.json was kept, so the delete guard is not on yet: merge settings.json.new-v$KV to turn it on."
}
Say "Open $(Join-Path $Dest 'dashboard.html') in any browser to start."
Say 'This folder is your vault. Everything lives here.'
Write-Host ''
