var color = d3.scaleOrdinal(d3.schemeTableau10);

var MC_ITERATIONS = 10000;
var AUGUSTA_MEAN = 72;
var AUGUSTA_STDDEV = 3;

function drawTreemap(entries, pot, purseData, allPlayers, totalRounds, roundsCompleted, picksLocked) {
    var svg = d3.select("svg#forceGraph");
    var width = +svg.attr("width");
    var height = +svg.attr("height");
    var div = d3.select("div.tooltip");

    if (!entries || entries.length === 0) return;

    var remainingRounds = totalRounds - roundsCompleted;
    var entryData = simulateExpectedPayouts(entries, pot, purseData, allPlayers, remainingRounds);

    // Build treemap hierarchy
    var root = d3.hierarchy({
        children: entryData.map(function(e) {
            return { name: e.id, value: Math.max(e.expectedPayout, 1), data: e };
        })
    }).sum(function(d) { return d.value; })
      .sort(function(a, b) { return b.value - a.value; });

    d3.treemap()
        .size([width, height])
        .padding(2)
        .round(true)(root);

    var cell = svg.selectAll("g")
        .data(root.leaves())
        .enter().append("g")
        .attr("transform", function(d) { return "translate(" + d.x0 + "," + d.y0 + ")"; });

    cell.append("rect")
        .attr("width", function(d) { return d.x1 - d.x0; })
        .attr("height", function(d) { return d.y1 - d.y0; })
        .attr("fill", function(d, i) { return color(i % 10); })
        .attr("stroke", "#fff")
        .attr("rx", 3)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke", "#333").attr("stroke-width", 2);
            var e = d.data.data;
            var html = "<strong>" + e.id + "</strong><br>" +
                "EV: $" + Math.round(e.expectedPayout).toLocaleString() + "<br>" +
                "P(1st): " + (e.p1 * 100).toFixed(1) + "%" +
                " &nbsp; P(2nd): " + (e.p2 * 100).toFixed(1) + "%";
            if (!picksLocked) {
                html += "<br>$" + Math.round(e.money).toLocaleString() + " current earnings";
                if (e.picks) {
                    html += "<br><br>";
                    e.picks.forEach(function(p) {
                        html += p.Player;
                        if (p.position) html += " (" + p.position + ")";
                        html += "<br>";
                    });
                }
            }
            div.html(html)
                .transition().duration(100).style("opacity", 0.9);
            div.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
        })
        .on("mousemove", function(event) {
            div.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("stroke", "#fff").attr("stroke-width", 1);
            div.transition().duration(200).style("opacity", 0);
        });

    // Entry name label
    cell.append("text")
        .attr("x", 6)
        .attr("y", 18)
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", "#fff")
        .style("pointer-events", "none")
        .text(function(d) { return d.data.name; })
        .each(function(d) {
            var boxWidth = d.x1 - d.x0 - 12;
            if (this.getComputedTextLength() > boxWidth) {
                d3.select(this).text(d.data.name.split(" ")[0]);
            }
        });

    // Expected payout label
    cell.append("text")
        .attr("x", 6)
        .attr("y", 34)
        .style("font-size", "11px")
        .style("fill", "rgba(255,255,255,0.8)")
        .style("pointer-events", "none")
        .text(function(d) {
            var boxWidth = d.x1 - d.x0;
            var boxHeight = d.y1 - d.y0;
            if (boxWidth < 60 || boxHeight < 40) return "";
            return "$" + Math.round(d.data.data.expectedPayout).toLocaleString();
        });

    // Win probability label
    cell.append("text")
        .attr("x", 6)
        .attr("y", 48)
        .style("font-size", "11px")
        .style("fill", "rgba(255,255,255,0.7)")
        .style("pointer-events", "none")
        .text(function(d) {
            var boxWidth = d.x1 - d.x0;
            var boxHeight = d.y1 - d.y0;
            if (boxWidth < 60 || boxHeight < 55) return "";
            return (d.data.data.p1 * 100).toFixed(1) + "% to win";
        });
}

// Box-Muller transform for normal random numbers
function randNormal(mean, stddev) {
    var u = 1 - Math.random();
    var v = Math.random();
    return mean + stddev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function simulateExpectedPayouts(entries, pot, purseData, allPlayers, remainingRounds) {
    // Build purse lookup: position (1-based) -> amount
    var purseLookup = {};
    purseData.forEach(function(row, i) {
        purseLookup[i + 1] = parseInt(row.amount, 10);
    });

    // Index all players by name for quick lookup
    var playersByName = {};
    allPlayers.forEach(function(p) {
        playersByName[p.Player] = p;
    });

    // Collect the set of all golfers picked by any entry
    var pickedGolferNames = {};
    entries.forEach(function(e) {
        e.picks.forEach(function(p) {
            pickedGolferNames[p.Player] = true;
        });
    });

    // Pre-compute current strokes for all players in the field
    // For players with no rounds completed, use par * rounds as baseline
    var golferStrokes = {};
    allPlayers.forEach(function(p) {
        if (p.status === "cut" || p.status === "wd" || p.status === "dq") {
            golferStrokes[p.Player] = { current: 0, active: false };
        } else {
            var current = p.strokes || 0;
            golferStrokes[p.Player] = { current: current, active: true };
        }
    });

    // Run Monte Carlo
    var winCounts = {};
    var secondCounts = {};
    entries.forEach(function(e) {
        winCounts[e.id] = 0;
        secondCounts[e.id] = 0;
    });

    // Pre-tournament: if no rounds completed, all entries equal
    if (remainingRounds >= 4) {
        var equal = 1 / entries.length;
        return entries.map(function(e) {
            var p2 = 0;
            entries.forEach(function(other) {
                if (other.id === e.id) return;
                var rem = 1 - equal;
                if (rem > 0) p2 += equal * (equal / rem);
            });
            return {
                id: e.id,
                picks: e.picks,
                money: e.money,
                p1: equal,
                p2: p2,
                expectedPayout: equal * 0.85 * pot + p2 * 0.15 * pot
            };
        });
    }

    for (var sim = 0; sim < MC_ITERATIONS; sim++) {
        // Simulate remaining rounds for ALL active golfers in the field
        var simTotals = {};
        allPlayers.forEach(function(p) {
            var gs = golferStrokes[p.Player];
            if (!gs.active) {
                simTotals[p.Player] = Infinity;
                return;
            }
            var total = gs.current;
            for (var r = 0; r < remainingRounds; r++) {
                total += Math.round(randNormal(AUGUSTA_MEAN, AUGUSTA_STDDEV));
            }
            simTotals[p.Player] = total;
        });

        // Determine positions from simulated totals (lower is better)
        var sorted = allPlayers.filter(function(p) { return golferStrokes[p.Player].active; })
            .map(function(p) { return { name: p.Player, strokes: simTotals[p.Player] }; })
            .sort(function(a, b) { return a.strokes - b.strokes; });

        // Assign positions with tie handling
        var simPositions = {};
        var i = 0;
        while (i < sorted.length) {
            var j = i;
            while (j < sorted.length && sorted[j].strokes === sorted[i].strokes) j++;
            var pos = i + 1;
            for (var k = i; k < j; k++) {
                simPositions[sorted[k].name] = pos;
            }
            i = j;
        }

        // Calculate simulated payouts (split ties like calcPayouts)
        var simPayouts = {};
        i = 0;
        while (i < sorted.length && i < 50) {
            var j2 = i;
            while (j2 < sorted.length && sorted[j2].strokes === sorted[i].strokes) j2++;
            var shared = 0;
            for (var k2 = i; k2 < j2 && k2 < 50; k2++) {
                shared += (purseLookup[k2 + 1] || 0);
            }
            var splitPayout = shared / (j2 - i);
            for (var k3 = i; k3 < j2; k3++) {
                simPayouts[sorted[k3].name] = k3 < 50 ? splitPayout : 0;
            }
            i = j2;
        }

        // Calculate each entry's total earnings in this simulation
        var entryTotals = entries.map(function(e) {
            var total = 0;
            e.picks.forEach(function(p) {
                total += (simPayouts[p.Player] || 0);
            });
            return { id: e.id, total: total };
        }).sort(function(a, b) { return b.total - a.total; });

        winCounts[entryTotals[0].id]++;
        secondCounts[entryTotals[1].id]++;
    }

    return entries.map(function(e) {
        var p1 = winCounts[e.id] / MC_ITERATIONS;
        var p2 = secondCounts[e.id] / MC_ITERATIONS;
        return {
            id: e.id,
            picks: e.picks,
            money: e.money,
            p1: p1,
            p2: p2,
            expectedPayout: p1 * 0.85 * pot + p2 * 0.15 * pot
        };
    });
}
