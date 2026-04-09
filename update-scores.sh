#!/bin/bash
# Fetches live ESPN scores, transforms, and pushes if changed.
# Intended to be run by Windows Task Scheduler every 5 minutes during the Masters.

set -e

cd "$(dirname "$0")"

git pull --rebase --autostash

ESPN_DATE=$(curl -sf -D - -o espn-raw.json \
  "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard/401811941" \
  | grep -i '^date:' | sed 's/^[Dd]ate: *//' | tr -d '\r')

node transform-espn.js espn-raw.json "$ESPN_DATE" > scores.json

git diff --quiet scores.json && exit 0

git add scores.json
git commit -m "refresh scores — $(date -u +%Y-%m-%dT%H:%M)"
git push
