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
            return { first_name: p.first_name, last_name: p.last_name, country: p.country, position: 0, status: "pre-tournament" };
        });
    }

    var players = processPlayers(leaderboard);
    var playerIndex = buildPlayerIndex(players);
    validateAllPicks(poolData, playerIndex);

    var payouts = calcPayouts(purseData, players);
    var nodes = buildNodes(players, payouts);
    var links = buildLinks(poolData, playerIndex);

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
    if (isLive) tabulatePoolPayout(nodesWithPicks);
    drawForce(nodes, picksLocked ? [] : links, payouts);

    if (isLive) {
        updateLastUpdatedDisplay(lastUpdated);
        var isCompleted = scoresData.results.tournament.live_details
            && scoresData.results.tournament.live_details.status === "completed";
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
    d3.select("svg#forceGraph").selectAll("*").remove();
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
        }).catch(function() {
            // Silently ignore fetch errors during polling
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
            ' (auto-refreshing every ' + Math.round(POLL_INTERVAL / 60000) + ' min)';
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
            golfer: true
        };
    });
}

function buildLinks(poolData, playerIndex) {
    let links = [];
    poolData.forEach(d => {
        for (let i = 1; i <= NUM_PICKS; i++) {
            const pickName = d["pick" + i];
            const player = findPlayer(playerIndex, pickName, d.name, i);
            links.push({
                source: d.name,
                target: player.Player,
                value: 3,
                label: player.Player
            });
        }
    });
    return links;
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
    if (player.status === "cut" || player.position > 50 || !payouts[player.position]) {
        return 0;
    }
    return payouts[player.position];
}

function calcPayouts(purse, players) {
    const payouts = [];
    const ranks = players.reduce((acc, player) => {
        const rank = player.position;
        acc[rank] = (acc[rank] || 0) + 1;
        return acc;
    }, {});

    let shared = 0;
    for (let i = 1; i <= 50; i++) {
        if (ranks[i]) {
            shared = 0;
            for (let j = 0; j < ranks[i] && i + j <= 50; j++) {
                shared += parseInt(purse[i + j - 1].amount, 10);
            }
            payouts[i] = shared / ranks[i];
        }
    }
    return payouts;
}

function tabulate(data, columns) {
    const table = d3.select('table').attr("class", "table table-striped table-bordered ");
    const thead = table.append('thead');
    const tbody = table.append('tbody');

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
            const ret = [d.id, parseInt(d.money, 10)];
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
    var label = player.Player;
    if (player.position)
        label += "(" + player.position + ")";
    else
        label = "<strike>" + label + "</strike>";
    var html = label;
    return html;
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
        buildLinks,
        enrichPicks,
        estimateMoney,
        calculatePurse,
        calcPayouts,
        textDisplay
    };
}

