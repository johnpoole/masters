Invoke-WebRequest -OutFile leaderboard-v2.json  https://statdata.pgatour.com/r/014/2018/leaderboard-v2.json
git add leaderboard-v2.json
git commit -m "refresh data"
git push

? https://www.masters.com/en_US/scores/feeds/2024/scores.json