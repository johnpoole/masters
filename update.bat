Invoke-WebRequest -OutFile scores.json https://www.masters.com/en_US/scores/feeds/2026/scores.json
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to download scores.json from masters.com"; exit 1 }

$json = Get-Content scores.json -Raw | ConvertFrom-Json
if (-not $json.results.leaderboard) { Write-Error "scores.json missing results.leaderboard — feed may not be live yet"; exit 1 }

$count = $json.results.leaderboard.Count
Write-Host "Downloaded $count players from leaderboard"

git add scores.json
git commit -m "refresh 2026 scores data"
git push
