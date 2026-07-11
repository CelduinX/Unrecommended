$ErrorActionPreference = 'Stop'
$releaseUrl = 'https://github.com/CelduinX/Unrecommended/releases/latest/download/unrecommended.zip'
$installDirectory = Join-Path $env:LOCALAPPDATA 'Unrecommended'
$downloadPath = Join-Path $env:TEMP 'unrecommended.zip'

Write-Host 'Unrecommended wird heruntergeladen ...' -ForegroundColor Cyan
Invoke-WebRequest -Uri $releaseUrl -OutFile $downloadPath -UseBasicParsing

if (Test-Path -LiteralPath $installDirectory) {
  Remove-Item -LiteralPath $installDirectory -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $installDirectory | Out-Null
Expand-Archive -LiteralPath $downloadPath -DestinationPath $installDirectory -Force
Remove-Item -LiteralPath $downloadPath -Force

Set-Clipboard -Value $installDirectory

$chromeCandidates = @(
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
)
$chromePath = $chromeCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1

if ($chromePath) {
  Start-Process -FilePath $chromePath -ArgumentList 'chrome://extensions'
}

Write-Host ''
Write-Host 'Fertig heruntergeladen.' -ForegroundColor Green
Write-Host "Der Installationsordner wurde in die Zwischenablage kopiert: $installDirectory"
Write-Host 'Aktiviere in Chrome den Entwicklermodus, wähle Entpackte Erweiterung laden und füge den kopierten Ordnerpfad ein.'
