// Assuming d3 and necessary libraries are loaded
document.addEventListener("DOMContentLoaded", function() {
    Promise.all([
        d3.csv("purse.csv"),
        d3.json("scores.json"),
        d3.csv("MastersPool2023.csv")
    ]).then(function([purseData, scoresData, poolData]) {
        const players = processPlayers(scoresData.results.leaderboard);
        const payouts = calcPayouts(purseData, players);
        const nodes = buildNodes(players, payouts);
        const links = buildLinks(poolData, players);

        const nodesWithPicks = enrichPicks(poolData, players, payouts);
        nodes.push(...nodesWithPicks);

        const header = ["name", "money"];
        tabulate(nodes, header);
    }).catch(error => console.error("Failed to load data: ", error));
});

function processPlayers(players) {
    return players.map(p => ({
        ...p,
        Player: `${p.first_name} ${p.last_name}`,
        purse: 0
    }));
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

function buildLinks(poolData, players) {
    let links = [];
    poolData.forEach(d => {
        for (let i = 1; i <= 8; i++) {
            const searchString = d["pick" + i].trim();
            const player = players.find(item => item.Player === searchString);
            if (player) {
                links.push({
                    source: d.name,
                    target: player.Player,
                    value: 3,
                    label: player.Player
                });
            }
        }
    });
    return links;
}

function enrichPicks(poolData, players, payouts) {
    return poolData.map(d => {
        const picks = [];
        for (let i = 1; i <= 8; i++) {
            let searchString = d["pick" + i].trim();
            let player = players.find(item => item.Player === searchString) || null;
            if (player) picks.push(player);
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
    if (player.status === "cut" || player.position >= 50 || !payouts[player.position]) {
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
    for (let i = 1; i < 50; i++) {
        if (ranks[i]) {
            shared = 0;
            for (let j = 0; j < ranks[i] && i + j < 50; j++) {
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

    // create a cell in each row for each column
    rows.selectAll('td')
        .data(d => {
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

function textDisplay(player) {
    var label = player.Player;
    if (player.position)
        label += "(" + player.position + ")";
    else
        label = "<strike>" + label + "</strike>";
    var html = label;
    return html;
}

