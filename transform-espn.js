// Transforms ESPN golf scoreboard JSON into the scores.json format main.js expects.
// Usage: node transform-espn.js espn-raw.json > scores.json

var fs = require("fs");

var raw = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

// ESPN sometimes spells names differently than the Masters field list.
// Map ESPN name → canonical name used in field2026.json / CSV picks.
var NAME_OVERRIDES = {
    "Si Woo Kim": "Si-woo Kim",
    "Sungjae Im": "Sung-jae Im"
};

var competition = raw.competitions[0];
var tournamentStatus = competition.status || {};
var statusType = tournamentStatus.type || {};
var currentRound = (tournamentStatus.period || 1);

var leaderboard = competition.competitors.map(function(c) {
    var athlete = c.athlete || {};
    var firstName = athlete.firstName || athlete.displayName.split(" ")[0];
    var lastName = athlete.lastName || athlete.displayName.split(" ").slice(1).join(" ");

    var fullName = firstName + " " + lastName;
    if (NAME_OVERRIDES[fullName]) {
        var parts = NAME_OVERRIDES[fullName].split(" ");
        firstName = parts[0];
        lastName = parts.slice(1).join(" ");
    }

    var position = parseInt(c.order, 10) || 0;
    var playerStatus = "active";

    // ESPN marks cut/withdrawn/disqualified players in the status object
    if (c.status && c.status.type) {
        var st = c.status.type.name || "";
        if (/cut/i.test(st)) playerStatus = "cut";
        else if (/wd|withdraw/i.test(st)) playerStatus = "wd";
        else if (/dq|disqualif/i.test(st)) playerStatus = "dq";
    }

    // If a player has completed fewer rounds than the current round and
    // the tournament is past round 2, infer cut
    if (playerStatus === "active" && currentRound > 2) {
        var rounds = (c.linescores || []).length;
        if (rounds > 0 && rounds < currentRound) {
            playerStatus = "cut";
        }
    }

    // ESPN 'order' is display order; map to position only for active players
    if (playerStatus !== "active") {
        position = 0;
    }

    var country = "";
    if (athlete.flag && athlete.flag.alt) country = athlete.flag.alt;

    // Total strokes from completed rounds
    var strokes = 0;
    var roundsCompleted = 0;
    (c.linescores || []).forEach(function(ls) {
        if (ls.value) {
            strokes += ls.value;
            roundsCompleted++;
        }
    });

    // Parse score-to-par from ESPN's display string ("E", "-3", "+2")
    var totalToPar = 0;
    if (c.score && c.score !== "E") {
        totalToPar = parseInt(c.score, 10) || 0;
    }

    return {
        first_name: firstName,
        last_name: lastName,
        country: country,
        position: position,
        total_to_par: totalToPar,
        status: playerStatus,
        strokes: strokes,
        rounds_completed: roundsCompleted
    };
});

// Sort by position (0 = unranked goes to end)
leaderboard.sort(function(a, b) {
    if (a.position === 0 && b.position === 0) return 0;
    if (a.position === 0) return 1;
    if (b.position === 0) return -1;
    return a.position - b.position;
});

var isCompleted = statusType.completed === true;
var espnDate = process.argv[3];
var updated = espnDate ? new Date(espnDate).toISOString() : new Date().toISOString();

var output = {
    results: {
        tournament: {
            id: raw.id,
            name: raw.name || "Masters Tournament",
            start_date: raw.date || "2026-04-09",
            live_details: {
                status: isCompleted ? "completed" : "inprogress",
                current_round: currentRound,
                total_rounds: 4,
                updated: updated,
                players: leaderboard.length
            }
        },
        leaderboard: leaderboard
    }
};

process.stdout.write(JSON.stringify(output, null, 2) + "\n");
