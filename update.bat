Set-Location "C:\Users\jdpoo\Documents\GitHub\masters2024"

try {
    Invoke-WebRequest -OutFile scores.json https://www.masters.com/en_US/scores/feeds/2026/scores.json -ErrorAction Stop
} catch {
    Write-Warning "Failed to download scores.json from masters.com — feed may not be live yet"
    exit 0
}

$json = Get-Content scores.json -Raw | ConvertFrom-Json
if (-not $json.results.leaderboard) {
    Write-Warning "scores.json missing results.leaderboard — feed may not be live yet"
    exit 0
}

$count = $json.results.leaderboard.Count
Write-Host "Downloaded $count players from leaderboard"

git diff --quiet scores.json
if ($LASTEXITCODE -eq 0) {
    Write-Host "No score changes, skipping commit"
    exit 0
}

$timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm"
git add scores.json
git commit -m "refresh scores — $timestamp"
git push
