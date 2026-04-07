Set-Location "C:\Users\jdpoo\Documents\GitHub\masters2024"

$espnUrl = "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard/401811941"

try {
    Invoke-WebRequest -OutFile espn-raw.json $espnUrl -ErrorAction Stop
} catch {
    Write-Error "Failed to download scores from ESPN: $_"
    exit 1
}

node transform-espn.js espn-raw.json > scores.json
if ($LASTEXITCODE -ne 0) {
    Write-Error "transform-espn.js failed with exit code $LASTEXITCODE"
    exit 1
}

$json = Get-Content scores.json -Raw | ConvertFrom-Json
if (-not $json.results.leaderboard) {
    Write-Error "scores.json missing results.leaderboard after transform"
    exit 1
}

$count = $json.results.leaderboard.Count
Write-Host "Downloaded $count players from ESPN"

git diff --quiet scores.json
if ($LASTEXITCODE -eq 0) {
    Write-Host "No score changes, skipping commit"
    exit 0
}

$timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm"
git add scores.json
git commit -m "refresh scores — $timestamp"
git push
