Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """C:\Program Files\Git\bin\bash.exe"" -c ""/c/Users/jdpoo/Documents/GitHub/masters2024/update-scores.sh >> /c/Users/jdpoo/Documents/GitHub/masters2024/update.log 2>&1""", 0, True
