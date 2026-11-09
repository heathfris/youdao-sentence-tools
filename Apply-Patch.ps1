param(
    [ValidateSet('Install','Restore','Check')][string]$Action = 'Check',
    [string]$ApplicationDirectory,
    [string]$StateDirectory
)
$ErrorActionPreference = 'Stop'
if (-not $StateDirectory) { $StateDirectory = Join-Path $PSScriptRoot 'local' }
$stateDirectory = [IO.Path]::GetFullPath($StateDirectory)
$localManifest = Join-Path $stateDirectory 'manifest.json'
function Find-YoudaoDirectory {
    if (Test-Path -LiteralPath $localManifest) {
        $cached = Get-Content -LiteralPath $localManifest -Raw | ConvertFrom-Json
        if (Test-Path -LiteralPath (Join-Path $cached.defaultApplicationDirectory 'YoudaoDict.exe')) { return $cached.defaultApplicationDirectory }
    }
    $registryRoots = @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall')
    foreach ($registryRoot in $registryRoots) {
        foreach ($key in Get-ChildItem -LiteralPath $registryRoot -ErrorAction SilentlyContinue) {
            $entry = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
            if (-not $entry) { continue }
            $location = $entry.PSObject.Properties['InstallLocation']
            if ($location -and $location.Value -and (Test-Path -LiteralPath (Join-Path ([string]$location.Value) 'YoudaoDict.exe'))) { return [string]$location.Value }
            $icon = $entry.PSObject.Properties['DisplayIcon']
            if ($icon -and $icon.Value -and ([string]$icon.Value -match '^"?([^"\r\n]+?\.exe)"?(?:,.*)?$')) {
                $folder = [IO.Path]::GetDirectoryName($Matches[1])
                if ($folder -and (Test-Path -LiteralPath (Join-Path $folder 'YoudaoDict.exe'))) { return $folder }
            }
        }
    }
    return Read-Host 'Youdao folder (the directory containing YoudaoDict.exe)'
}
if (-not $ApplicationDirectory) { $ApplicationDirectory = Find-YoudaoDirectory }
if (-not $ApplicationDirectory) { throw 'A Youdao installation directory is required.' }
if ($Action -eq 'Install' -or -not (Test-Path -LiteralPath $localManifest)) {
    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $node) { throw 'Node.js 22 or newer is required to generate the local patch.' }
    $nodeVersion = & $node.Source --version
    if ($nodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 22) { throw 'Node.js 22 or newer is required.' }
    & $node.Source (Join-Path $PSScriptRoot 'source\build.cjs') $ApplicationDirectory $stateDirectory
    if ($LASTEXITCODE -ne 0) { throw 'Local patch generation failed. The Youdao installation was not modified.' }
}

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$package = $stateDirectory
$manifest = Get-Content -LiteralPath (Join-Path $package 'manifest.json') -Raw | ConvertFrom-Json
if (-not $ApplicationDirectory) { $ApplicationDirectory = $manifest.defaultApplicationDirectory }
$applicationRoot = [IO.Path]::GetFullPath($ApplicationDirectory).TrimEnd('\','/')
$htmlRoot = [IO.Path]::GetFullPath((Join-Path $applicationRoot ($manifest.version + '\resultui\html')))
function Get-TargetPath([string]$RelativePath) {
    $target = [IO.Path]::GetFullPath((Join-Path $htmlRoot $RelativePath))
    if (-not $target.StartsWith($htmlRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'The manifest path is outside the selected application.'
    }
    return $target
}
function Get-Sha256([string]$FilePath) { return (Get-FileHash -LiteralPath $FilePath -Algorithm SHA256).Hash.ToLowerInvariant() }
$executable = Join-Path $applicationRoot 'YoudaoDict.exe'
if ((Get-Item -LiteralPath $executable).VersionInfo.FileVersion -ne $manifest.version) { throw 'Unsupported Youdao version. No files changed.' }
if ((Get-Sha256 $executable) -ne $manifest.executableSha256) { throw 'The Youdao executable fingerprint differs. No files changed.' }
foreach ($dependency in $manifest.dependencies) {
    if ((Get-Sha256 (Get-TargetPath $dependency.path)) -ne $dependency.sha256) { throw ('Dependency fingerprint differs: ' + $dependency.path + '. No files changed.') }
}
$states = @()
foreach ($file in $manifest.files) {
    $currentHash = Get-Sha256 (Get-TargetPath $file.path)
    if ($currentHash -eq $file.original) { $state = 'Original' }
    elseif ($currentHash -eq $file.patched) { $state = 'Patched' }
    elseif ($file.previous -contains $currentHash) { $state = 'PreviousPatch' }
    else { throw ('Unknown file fingerprint: ' + $file.path + '. No files changed.') }
    $states += [PSCustomObject]@{ File=$file; State=$state; CurrentHash=$currentHash }
}
if ($Action -eq 'Check') { $states | ForEach-Object { Write-Output ($_.File.path + ': ' + $_.State) }; return }
$wantedState = if ($Action -eq 'Install') { 'Patched' } else { 'Original' }
$changes = @($states | Where-Object { $_.CurrentHash -ne $(if ($Action -eq 'Install') { $_.File.patched } else { $_.File.original }) })
if ($changes.Count -eq 0) { Write-Output ('Already ' + $wantedState + '.'); return }
$running = @(Get-Process -Name 'YoudaoDict' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $executable })
if ($running.Count) { throw 'Please exit Youdao completely, including its tray icon, and run this script again.' }
$sourceDirectory = if ($Action -eq 'Install') { 'patched' } else { 'original' }
$pending = @()
foreach ($item in $changes) {
    $file = $item.File
    $source = Join-Path (Join-Path $package $sourceDirectory) $file.name
    $expected = if ($Action -eq 'Install') { $file.patched } else { $file.original }
    if ((Get-Sha256 $source) -ne $expected) { throw ('Package file fingerprint differs: ' + $file.name + '. No files changed.') }
    $target = Get-TargetPath $file.path
    $pending += [PSCustomObject]@{ Source=$source; Target=$target; Expected=$expected; Previous=[IO.File]::ReadAllBytes($target); Temporary=$target+'.sentence-patch.tmp' }
}
try {
    foreach ($item in $pending) {
        [IO.File]::WriteAllBytes($item.Temporary, [IO.File]::ReadAllBytes($item.Source))
        if ((Get-Sha256 $item.Temporary) -ne $item.Expected) { throw 'Temporary file verification failed.' }
    }
    foreach ($item in $pending) { Move-Item -LiteralPath $item.Temporary -Destination $item.Target -Force }
    foreach ($item in $pending) { if ((Get-Sha256 $item.Target) -ne $item.Expected) { throw 'Installed file verification failed.' } }
} catch {
    foreach ($item in $pending) { [IO.File]::WriteAllBytes($item.Target, $item.Previous) }
    throw
} finally {
    foreach ($item in $pending) { if (Test-Path -LiteralPath $item.Temporary) { Remove-Item -LiteralPath $item.Temporary -Force } }
}
Write-Output ('Youdao sentence tools: ' + $wantedState + '. Restart Youdao to use the result.')
