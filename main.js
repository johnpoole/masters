var NUM_PICKS = 6;
var ENTRY_FEE = 40;
var FIRST_PLACE_PCT = 0.85;
var SECOND_PLACE_PCT = 0.15;
var POLL_INTERVAL = 180000; // 3 minutes
var PICKS_REVEAL = new Date("2026-04-09T00:00:00Z"); // Wed Apr 8 6pm MST = midnight UTC Apr 9

var cachedPurseData = null;
var cachedFieldData = null;
var cachedPoolData = null;
var lastUpdated = null;
var pollTimer = null;

// Assuming d3 and necessary libraries are loaded
if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function() {
    Promise.all([
        d3.csv("purse.csv"),
        d3.json("scores.json"),
        d3.json("field2026.json"),
        d3.csv("MastersPool2026.csv")
    ]).then(function([purseData, scoresData, fieldData, poolData]) {
        cachedPurseData = purseData;
        cachedFieldData = fieldData;
        cachedPoolData = poolData;

        renderAll(purseData, scoresData, fieldData, poolData);
    }).catch(function(error) {
        document.body.insertAdjacentHTML("afterbegin",
            '<div class="alert alert-danger" role="alert">' +
            '<strong>Fatal error:</strong> ' + error.message +
            '</div>');
        throw error;
    });
});

function isLiveData(scoresData) {
    return scoresData && scoresData.results && scoresData.results.leaderboard
        && scoresData.results.tournament
        && scoresData.results.tournament.start_date
        && scoresData.results.tournament.start_date.substring(0, 4) === "2026";
}

function renderAll(purseData, scoresData, fieldData, poolData) {
    var isLive = isLiveData(scoresData);

    var leaderboard;
    if (isLive) {
        leaderboard = scoresData.results.leaderboard;
        lastUpdated = scoresData.results.tournament.live_details
            ? scoresData.results.tournament.live_details.updated : null;
    } else {
        leaderboard = fieldData.players.map(function(p) {
            return { first_name: p.first_name, last_name: p.last_name, country: p.country, position: 0, status: "pre-tournament", pga_id: p.pga_id || null };
        });
    }

    var players = processPlayers(leaderboard);
    var playerIndex = buildPlayerIndex(players);
    validateAllPicks(poolData, playerIndex);

    var payouts = calcPayouts(purseData, players);
    players.forEach(function(p) { p.purseShare = payouts[p.position] || 0; });
    var nodes = buildNodes(players, payouts);

    var nodesWithPicks = enrichPicks(poolData, playerIndex, payouts);
    nodes.push.apply(nodes, nodesWithPicks);

    // Clear any previous alert banners
    document.querySelectorAll(".alert").forEach(function(el) { el.remove(); });

    var picksLocked = new Date() < PICKS_REVEAL;

    if (picksLocked) {
        document.body.insertAdjacentHTML("afterbegin",
            '<div class="alert alert-warning" role="alert">' +
            'Picks are locked and hidden until Wednesday at 6 PM MST.' +
            '</div>');
    } else if (!isLive) {
        document.body.insertAdjacentHTML("afterbegin",
            '<div class="alert alert-info" role="alert">' +
            'Pre-tournament mode — using 2026 invited field. Scores will appear once the tournament is live.' +
            '</div>');
    }

    var header = ["name", "money"];
    tabulate(nodes, header);
    var isCompleted = isLive && scoresData.results.tournament.live_details
        && scoresData.results.tournament.live_details.status === "completed";
    if (isCompleted) tabulatePoolPayout(nodesWithPicks);
    var pot = poolData.length * ENTRY_FEE;
    var totalRounds = 4;
    var roundsCompleted = 0;
    if (isLive && scoresData.results.tournament.live_details) {
        totalRounds = scoresData.results.tournament.live_details.total_rounds || 4;
        // Use max rounds_completed across active golfers as the tournament progress
        players.forEach(function(p) {
            if (p.status === "active" && p.rounds_completed > roundsCompleted) {
                roundsCompleted = p.rounds_completed;
            }
        });
    }
    drawTreemap(nodesWithPicks, pot, purseData, players, totalRounds, roundsCompleted, picksLocked);

    if (isLive) {
        updateLastUpdatedDisplay(lastUpdated);
        if (isCompleted) {
            stopPolling();
            updateLastUpdatedDisplay(lastUpdated, true);
        } else if (!pollTimer) {
            startPolling();
        }
    }
}

function clearRenderedContent() {
    d3.select("table thead").selectAll("*").remove();
    d3.select("table tbody").selectAll("*").remove();
    var card = document.querySelector(".card");
    if (card) card.remove();
}

function startPolling() {
    pollTimer = setInterval(function() {
        d3.json("scores.json?_t=" + Date.now()).then(function(newData) {
            if (!isLiveData(newData)) return;

            var newTimestamp = newData.results.tournament.live_details
                ? newData.results.tournament.live_details.updated : null;
            if (newTimestamp && newTimestamp === lastUpdated) return;

            clearRenderedContent();
            renderAll(cachedPurseData, newData, cachedFieldData, cachedPoolData);
        }).catch(function(err) {
            var el = document.getElementById("lastUpdated");
            if (el) el.innerHTML = "Score update failed — will retry in " + Math.round(POLL_INTERVAL / 60000) + " min";
        });
    }, POLL_INTERVAL);
}

function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

function updateLastUpdatedDisplay(timestamp, completed) {
    var el = document.getElementById("lastUpdated");
    if (!el) return;
    if (completed) {
        el.innerHTML = "Tournament Complete — Final Results";
    } else if (timestamp) {
        var date = new Date(timestamp);
        var timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        el.innerHTML = '<span class="live-dot"></span>Last updated: ' + timeStr +
            ' (auto-refreshing every 5 min)';
    }
}

function normalizeName(name) {
    return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function processPlayers(players) {
    return players.map(p => ({
        ...p,
        Player: `${p.first_name} ${p.last_name}`.trim(),
        purse: 0
    }));
}

function buildPlayerIndex(players) {
    const index = new Map();
    players.forEach(p => {
        const key = normalizeName(p.Player);
        if (index.has(key)) {
            throw new Error(
                "Duplicate player name in leaderboard: '" + p.Player +
                "' (normalized: '" + key + "')"
            );
        }
        index.set(key, p);
    });
    return index;
}

function findPlayer(playerIndex, pickName, poolEntryName, pickNumber) {
    const key = normalizeName(pickName);
    const player = playerIndex.get(key);
    if (!player) {
        throw new Error(
            "Unmatched pick: '" + pickName + "' (pick" + pickNumber +
            " for " + poolEntryName + ") not found on leaderboard. " +
            "Check spelling in CSV."
        );
    }
    return player;
}

function validateAllPicks(poolData, playerIndex) {
    const errors = [];
    poolData.forEach(d => {
        for (let i = 1; i <= NUM_PICKS; i++) {
            const pickName = d["pick" + i];
            if (!pickName || !pickName.trim()) {
                errors.push(d.name + " pick" + i + ": empty pick");
                continue;
            }
            const key = normalizeName(pickName);
            if (!playerIndex.has(key)) {
                errors.push(
                    d.name + " pick" + i + ": '" + pickName.trim() +
                    "' not found on leaderboard"
                );
            }
        }
    });
    if (errors.length > 0) {
        throw new Error(
            errors.length + " unmatched pick(s) in CSV:\n" +
            errors.join("\n")
        );
    }
}

function buildNodes(players, payouts) {
    return players.map(p => {
        const purse = calculatePurse(p, payouts);
        return {
            id: p.Player,
            group: 3,
            label: p.Player,
            money: purse,
            golfer: true,
            pga_id: p.pga_id || null
        };
    });
}


function enrichPicks(poolData, playerIndex, payouts) {
    return poolData.map(d => {
        const picks = [];
        for (let i = 1; i <= NUM_PICKS; i++) {
            const pickName = d["pick" + i];
            const player = findPlayer(playerIndex, pickName, d.name, i);
            picks.push(player);
        }
        const money = estimateMoney(picks, payouts);
        return {
            id: d.name,
            picks,
            group: 10,
            label: d.name,
            money
        };
    });
}

function estimateMoney(picks, payouts) {
    return picks.reduce((total, p) => total + calculatePurse(p, payouts), 0);
}

function calculatePurse(player, payouts) {
    if (player.status === "cut") {
        return 0;
    }
    return payouts[player.position] || 0;
}

function calcPayouts(purse, players) {
    // ESPN assigns sequential positions (1, 2, 3, ...) even for tied golfers.
    // Detect ties by grouping consecutive active players with the same total_to_par,
    // then split the combined purse for those slots equally.
    var active = players
        .filter(function(p) { return p.status === "active" && p.position > 0; })
        .slice()
        .sort(function(a, b) { return a.position - b.position; });

    var payouts = {};
    var i = 0;
    while (i < active.length) {
        var score = active[i].total_to_par;
        var j = i;
        while (j < active.length && active[j].total_to_par === score) {
            j++;
        }
        // Players i..j-1 occupy slots (i+1)..(j) in the standings.
        var count = j - i;
        var shared = 0;
        for (var k = 0; k < count; k++) {
            var slot = active[i + k].position; // ESPN position IS the purse slot
            if (slot <= 50) {
                shared += parseInt(purse[slot - 1].amount, 10);
            }
        }
        var each = shared / count;
        for (var k = 0; k < count; k++) {
            payouts[active[i + k].position] = each;
        }
        i = j;
    }
    return payouts;
}

function tabulate(data, columns) {
    const table = d3.select('table').attr("class", "table table-striped table-bordered ");
    var thead = table.select('thead');
    if (thead.empty()) thead = table.append('thead');
    var tbody = table.select('tbody');
    if (tbody.empty()) tbody = table.append('tbody');

    // append the header row
    thead.append('tr')
        .selectAll('th')
        .data(columns)
        .enter()
        .append('th')
        .text(column => column);

    // create a row for each object in the data
    const rows = tbody.selectAll('tr')
        .data(
            data.filter(d => !d.golfer)
                .sort((a, b) => a.golfer ? 1 : b.money - a.money)
        )
        .enter()
        .append('tr');

    var picksLocked = new Date() < PICKS_REVEAL;

    // create a cell in each row for each column
    rows.selectAll('td')
        .data(d => {
            if (picksLocked) return [d.id, "—"];
            const ret = [d.id, "$" + parseInt(d.money, 10).toLocaleString()];
            d.picks.sort((a, b) => a.position - b.position)
                .forEach(p => ret.push(textDisplay(p)));
            return ret;
        })
        .enter()
        .append('td')
        .html(d => d);

    return table;
}

function tabulatePoolPayout(entries) {
    if (entries.length < 2) return;
    if (new Date() < PICKS_REVEAL) return;

    var sorted = entries.slice().sort(function(a, b) { return b.money - a.money; });
    var pot = entries.length * ENTRY_FEE;
    var first = sorted[0];
    var second = sorted[1];

    var div = document.createElement("div");
    div.className = "card mb-3";
    div.innerHTML =
        '<div class="card-body">' +
        '<h5 class="card-title">Pool Payout</h5>' +
        '<p>' + entries.length + ' entries &times; $' + ENTRY_FEE + ' = <strong>$' + pot + ' pot</strong></p>' +
        '<table class="table table-sm" style="width:auto;">' +
        '<tr><td>1st (' + Math.round(FIRST_PLACE_PCT * 100) + '%)</td>' +
        '<td><strong>' + first.id + '</strong></td>' +
        '<td>$' + Math.round(pot * FIRST_PLACE_PCT) + '</td></tr>' +
        '<tr><td>2nd (' + Math.round(SECOND_PLACE_PCT * 100) + '%)</td>' +
        '<td><strong>' + second.id + '</strong></td>' +
        '<td>$' + Math.round(pot * SECOND_PLACE_PCT) + '</td></tr>' +
        '</table></div>';

    var table = document.querySelector("table");
    table.parentNode.insertBefore(div, table);
}

function textDisplay(player) {
    var name = player.Player;
    if (player.pga_id) {
        name = '<a href="https://www.masters.com/en_US/players/player_' + player.pga_id + '.html" target="_blank">' + name + '</a>';
    }
    if (player.status === "cut" || player.status === "wd" || player.status === "dq") {
        name = "<strike>" + name + "</strike>";
    } else if (player.purseShare) {
        name += " ($" + Math.round(player.purseShare).toLocaleString() + ")";
    } else if (player.position) {
        name += " (" + player.position + ")";
    }
    return name;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        NUM_PICKS,
        ENTRY_FEE,
        FIRST_PLACE_PCT,
        SECOND_PLACE_PCT,
        normalizeName,
        processPlayers,
        buildPlayerIndex,
        findPlayer,
        validateAllPicks,
        buildNodes,
        enrichPicks,
        estimateMoney,
        calculatePurse,
        calcPayouts,
        textDisplay
    };
}

