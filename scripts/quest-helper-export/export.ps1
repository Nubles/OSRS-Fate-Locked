param([string]$HelperDirectory)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if (-not $HelperDirectory) { $HelperDirectory = Join-Path $repoRoot '../quest-source-research/quest-helper' }
$helperRoot = (Resolve-Path -LiteralPath $HelperDirectory).Path
$revision = (& git -C $helperRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $revision -ne '633ab56e2eb3eb363f21da3fd75f6f2bc0fa073a') { throw 'The helper checkout does not match the reviewed source revision.' }
$previousCache = $env:GRADLE_USER_HOME
$previousMap = $env:RUNEPROOF_CATALOG_MAP
$previousOutput = $env:RUNEPROOF_EXPORT_OUT
try {
    $env:GRADLE_USER_HOME = Join-Path (Split-Path $helperRoot) 'gradle-cache'
    $env:RUNEPROOF_CATALOG_MAP = Join-Path $PSScriptRoot 'catalog-map.json'
    $env:RUNEPROOF_EXPORT_OUT = Join-Path $repoRoot 'data/sources/runeproof-helper-graph.json.gz'
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'RuneProofExportTest.java') -Destination (Join-Path $helperRoot 'src/test/java/com/questhelper/RuneProofExportTest.java')
    Push-Location -LiteralPath $helperRoot
    try {
        & ./gradlew.bat --no-daemon --init-script (Join-Path $PSScriptRoot 'pin.gradle') test --tests com.questhelper.RuneProofExportTest --rerun-tasks
        if ($LASTEXITCODE -ne 0) { throw 'Quest Helper graph export failed.' }
    } finally { Pop-Location }
} finally {
    $env:GRADLE_USER_HOME = $previousCache
    $env:RUNEPROOF_CATALOG_MAP = $previousMap
    $env:RUNEPROOF_EXPORT_OUT = $previousOutput
}
