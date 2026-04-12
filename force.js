var MC_ITERATIONS = 10000;
var AUGUSTA_MEAN = 72;
var AUGUSTA_STDDEV = 3;
var SHRINKAGE_K = 4;           // Prior rounds for mean/variance shrinkage
var ROUND_EFFECT_STDDEV = 1.5; // Shared conditions effect per simulated round

function nameHash(str) {
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash; // convert to 32-bit int
    }
    return Math.abs(hash);
}

function nameColor(name) {
    var h = nameHash(name) % 360;
    return "hsl(" + h + ", 55%, 45%)";
}

function drawTreemap(entries, pot, purseData, allPlayers, totalRounds, roundsCompleted, picksLocked) {
    var svg = d3.select("svg#forceGraph");
    var width = +svg.attr("width");
    var height = +svg.attr("height");
    var div = d3.select("div.tooltip");

    if (!entries || entries.length === 0) return;

    var remainingRounds = totalRounds - roundsCompleted;
    var entryData = simulateExpectedPayouts(entries, pot, purseData, allPlayers, remainingRounds, totalRounds);

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

    var isUpdate = svg.selectAll("g.cell").size() > 0;
    var T = isUpdate ? 2000 : 0;

    // Data join keyed by entry name
    var cell = svg.selectAll("g.cell")
        .data(root.leaves(), function(d) { return d.data.name; });

    // EXIT
    cell.exit().remove();

    // ENTER
    var cellEnter = cell.enter().append("g")
        .attr("class", "cell")
        .attr("transform", function(d) { return "translate(" + d.x0 + "," + d.y0 + ")"; });

    cellEnter.append("rect")
        .attr("width", function(d) { return d.x1 - d.x0; })
        .attr("height", function(d) { return d.y1 - d.y0; })
        .attr("fill", function(d) { return nameColor(d.data.name); })
        .attr("stroke", "#fff")
        .attr("rx", 3)
        .style("cursor", "pointer");

    cellEnter.append("text").attr("class", "label-name")
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", "#fff")
        .style("pointer-events", "none");

    cellEnter.append("text").attr("class", "label-ev")
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "rgba(255,255,255,0.8)")
        .style("pointer-events", "none");

    cellEnter.append("text").attr("class", "label-prob")
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "rgba(255,255,255,0.7)")
        .style("pointer-events", "none");

    // ENTER + UPDATE (merge)
    var cellMerge = cellEnter.merge(cell);

    cellMerge.transition().duration(T)
        .attr("transform", function(d) { return "translate(" + d.x0 + "," + d.y0 + ")"; });

    cellMerge.select("rect")
        .transition().duration(T)
        .attr("width", function(d) { return d.x1 - d.x0; })
        .attr("height", function(d) { return d.y1 - d.y0; });

    // Hover events (re-bind necessary since data reference changes)
    cellMerge.select("rect")
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

    // Update text positions and content
    cellMerge.select(".label-name")
        .transition().duration(T)
        .attr("x", function(d) { return (d.x1 - d.x0) / 2; })
        .attr("y", function(d) { return (d.y1 - d.y0) / 2 - 10; });
    cellMerge.select(".label-name")
        .text(function(d) { return d.data.name; })
        .each(function(d) {
            var boxWidth = d.x1 - d.x0 - 8;
            if (this.getComputedTextLength() > boxWidth) {
                d3.select(this).text(d.data.name.split(" ")[0]);
            }
        });

    cellMerge.select(".label-ev")
        .transition().duration(T)
        .attr("x", function(d) { return (d.x1 - d.x0) / 2; })
        .attr("y", function(d) { return (d.y1 - d.y0) / 2 + 6; });
    cellMerge.select(".label-ev")
        .text(function(d) {
            var boxWidth = d.x1 - d.x0;
            var boxHeight = d.y1 - d.y0;
            if (boxWidth < 60 || boxHeight < 40) return "";
            return "$" + Math.round(d.data.data.expectedPayout).toLocaleString();
        });

    cellMerge.select(".label-prob")
        .transition().duration(T)
        .attr("x", function(d) { return (d.x1 - d.x0) / 2; })
        .attr("y", function(d) { return (d.y1 - d.y0) / 2 + 22; });
    cellMerge.select(".label-prob")
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

function simulateExpectedPayouts(entries, pot, purseData, allPlayers, remainingRounds, totalRounds) {
    // Build purse lookup: position (1-based) -> amount
    var purseLookup = {};
    purseData.forEach(function(row, i) {
        purseLookup[i + 1] = parseInt(row.amount, 10);
    });

    // Collect completed round scores from active players for field-wide stats
    var allRoundScores = [];
    allPlayers.forEach(function(p) {
        if (p.status !== "active") return;
        (p.round_scores || []).forEach(function(s) {
            allRoundScores.push(s);
        });
    });

    // Field-wide mean and variance (fallback to Augusta par if no data)
    var fieldMean = AUGUSTA_MEAN;
    var fieldVariance = AUGUSTA_STDDEV * AUGUSTA_STDDEV;
    if (allRoundScores.length > 1) {
        fieldMean = allRoundScores.reduce(function(a, b) { return a + b; }, 0) / allRoundScores.length;
        var fv = 0;
        allRoundScores.forEach(function(s) { fv += (s - fieldMean) * (s - fieldMean); });
        fieldVariance = fv / (allRoundScores.length - 1);
    }

    // Build per-player model: shrunk mean and variance from round_scores
    var completedRounds = totalRounds - remainingRounds;
    var golferModels = {};

    allPlayers.forEach(function(p) {
        if (p.status === "cut" || p.status === "wd" || p.status === "dq") {
            golferModels[p.Player] = { active: false };
            return;
        }

        var scores = p.round_scores || [];
        var n = scores.length;

        // Player's raw per-round mean
        var playerMean = n > 0
            ? scores.reduce(function(a, b) { return a + b; }, 0) / n
            : fieldMean;

        // Shrink mean toward field: w = n / (n + K)
        var wMean = n / (n + SHRINKAGE_K);
        var mu = wMean * playerMean + (1 - wMean) * fieldMean;

        // Player's raw variance (need >= 2 rounds)
        var playerVar = fieldVariance;
        if (n > 1) {
            playerVar = 0;
            scores.forEach(function(s) { playerVar += (s - playerMean) * (s - playerMean); });
            playerVar /= (n - 1);
        }

        // Shrink variance toward field: weight by (n-1) degrees of freedom
        var wVar = Math.max(0, n - 1) / (Math.max(0, n - 1) + SHRINKAGE_K);
        var sigma = Math.sqrt(wVar * playerVar + (1 - wVar) * fieldVariance);

        // Baseline: actual strokes through completed rounds
        var toPar = p.total_to_par || 0;
        var current = AUGUSTA_MEAN * completedRounds + toPar;

        golferModels[p.Player] = { active: true, current: current, mu: mu, sigma: sigma };
    });

    // Monte Carlo simulation
    var winCounts = {};
    var secondCounts = {};
    entries.forEach(function(e) {
        winCounts[e.id] = 0;
        secondCounts[e.id] = 0;
    });

    for (var sim = 0; sim < MC_ITERATIONS; sim++) {
        // Shared round effects: weather/conditions move all scores together
        var roundEffects = [];
        for (var r = 0; r < remainingRounds; r++) {
            roundEffects.push(randNormal(0, ROUND_EFFECT_STDDEV));
        }

        // Simulate remaining rounds for every active golfer
        var simTotals = {};
        allPlayers.forEach(function(p) {
            var model = golferModels[p.Player];
            if (!model.active) {
                simTotals[p.Player] = Infinity;
                return;
            }
            var total = model.current;
            for (var r = 0; r < remainingRounds; r++) {
                // S_ir = mu_i + alpha_r + epsilon_ir
                total += Math.round(model.mu + roundEffects[r] + randNormal(0, model.sigma));
            }
            simTotals[p.Player] = total;
        });

        // Rank by total strokes (lower is better)
        var sorted = allPlayers.filter(function(p) { return golferModels[p.Player].active; })
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

        // Calculate simulated payouts (split ties)
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

        // Each entry's total earnings in this simulation
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
