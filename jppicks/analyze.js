const fs = require("fs");
const path = require("path");

// --- Load data ---
const odds = JSON.parse(fs.readFileSync(path.join(__dirname, "odds2026.json"), "utf8")).odds;
const field = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "field2026.json"), "utf8")).players;

// 2023 pool pick frequency — used to estimate 2026 ownership
const CHALK_2023 = {
    "Scottie Scheffler": 86, "Rory McIlroy": 79, "Jon Rahm": 64,
    "Corey Conners": 64, "Jordan Spieth": 57, "Collin Morikawa": 50,
    "Justin Thomas": 50, "Patrick Cantlay": 50, "Max Homa": 36,
    "Cameron Smith": 36, "Jason Day": 29, "Xander Schauffele": 21,
    "Dustin Johnson": 21, "Tony Finau": 21, "Viktor Hovland": 14,
    "Sam Burns": 14, "Matt Fitzpatrick": 14
};

// --- Helpers ---

function impliedProb(americanOdds) {
    // Convert American odds to implied probability
    return 100 / (americanOdds + 100);
}

function top20Prob(americanOdds) {
    // Rough estimate: top-20 probability ~ 4x win probability for favorites,
    // scaling up to ~6x for longshots (longshots more likely to sneak a top-20
    // than to actually win)
    const winProb = impliedProb(americanOdds);
    const multiplier = americanOdds <= 1500 ? 4 : americanOdds <= 5000 ? 5 : 6;
    return Math.min(winProb * multiplier, 0.85);
}

function estimateOwnership(player, americanOdds) {
    // If they were picked in 2023, use that as a baseline with adjustment
    if (CHALK_2023[player]) {
        return CHALK_2023[player];
    }
    // Otherwise estimate from odds: shorter odds = higher ownership
    if (americanOdds <= 1500) return 60;
    if (americanOdds <= 2500) return 35;
    if (americanOdds <= 4000) return 15;
    if (americanOdds <= 6000) return 8;
    if (americanOdds <= 10000) return 4;
    return 2;
}

function leverage(top20, ownership) {
    // Leverage = how much top-20 equity you get per point of ownership
    if (ownership === 0) return Infinity;
    return top20 / (ownership / 100);
}

// --- Build analysis ---

const analysis = odds.map(p => {
    const winProb = impliedProb(p.odds);
    const t20 = top20Prob(p.odds);
    const own = estimateOwnership(p.player, p.odds);
    const lev = leverage(t20, own);

    return {
        player: p.player,
        odds: "+" + p.odds,
        tier: p.tier,
        winPct: (winProb * 100).toFixed(1) + "%",
        top20Pct: (t20 * 100).toFixed(0) + "%",
        projOwn: own + "%",
        leverage: lev.toFixed(2),
        _lev: lev,
        _own: own,
        _t20: t20
    };
});

// --- Output ---

console.log("=== 2026 MASTERS POOL ANALYSIS ===\n");
console.log("Strategy: Contrarian picks — high leverage (top-20 equity / projected ownership)\n");

// Top leverage plays
const byLeverage = [...analysis].sort((a, b) => b._lev - a._lev);

console.log("--- TOP LEVERAGE PLAYS (best value) ---\n");
console.log(
    "Player".padEnd(24) +
    "Odds".padStart(7) +
    "Win%".padStart(7) +
    "T20%".padStart(7) +
    "Own%".padStart(7) +
    "Lev".padStart(8)
);
console.log("-".repeat(60));
byLeverage.slice(0, 20).forEach(p => {
    console.log(
        p.player.padEnd(24) +
        p.odds.padStart(7) +
        p.winPct.padStart(7) +
        p.top20Pct.padStart(7) +
        p.projOwn.padStart(7) +
        p.leverage.padStart(8)
    );
});

// Chalk (everyone will pick these)
console.log("\n--- CHALK (high ownership, low leverage) ---\n");
console.log(
    "Player".padEnd(24) +
    "Odds".padStart(7) +
    "Win%".padStart(7) +
    "T20%".padStart(7) +
    "Own%".padStart(7) +
    "Lev".padStart(8)
);
console.log("-".repeat(60));
const chalk = [...analysis].filter(p => p._own >= 40).sort((a, b) => b._own - a._own);
chalk.forEach(p => {
    console.log(
        p.player.padEnd(24) +
        p.odds.padStart(7) +
        p.winPct.padStart(7) +
        p.top20Pct.padStart(7) +
        p.projOwn.padStart(7) +
        p.leverage.padStart(8)
    );
});

// Suggested builds
console.log("\n--- SUGGESTED BUILDS ---\n");
console.log("Build 1: MAX CONTRARIAN (1 chalk + 5 leverage plays)");
const chalk1 = byLeverage.find(p => p.tier === "elite");
const leveragePlays = byLeverage.filter(p =>
    p.tier !== "elite" && p._own < 30 && p._t20 > 0.15
);
const build1 = [chalk1, ...leveragePlays.slice(0, 5)];
build1.forEach(p => {
    console.log("  " + p.player.padEnd(22) + p.odds.padStart(7) + "  own:" + p.projOwn.padStart(4) + "  t20:" + p.top20Pct.padStart(4));
});

console.log("\nBuild 2: BALANCED (2 chalk + 4 leverage plays)");
const topChalk = [...analysis].filter(p => p.tier === "elite").sort((a, b) => a._own - b._own);
const build2Chalk = topChalk.slice(0, 2);
const build2Long = byLeverage.filter(p =>
    p.tier !== "elite" && p._own < 25 && p._t20 > 0.12
).slice(0, 4);
const build2 = [...build2Chalk, ...build2Long];
build2.forEach(p => {
    console.log("  " + p.player.padEnd(22) + p.odds.padStart(7) + "  own:" + p.projOwn.padStart(4) + "  t20:" + p.top20Pct.padStart(4));
});

console.log("\nBuild 3: DEEP LONGSHOT (0 chalk + 6 high-leverage mid/longshots)");
const build3 = byLeverage.filter(p =>
    p.tier !== "elite" && p._t20 > 0.10
).slice(0, 6);
build3.forEach(p => {
    console.log("  " + p.player.padEnd(22) + p.odds.padStart(7) + "  own:" + p.projOwn.padStart(4) + "  t20:" + p.top20Pct.padStart(4));
});

console.log("\n--- KEY ---");
console.log("Win%  = implied probability of winning (from odds)");
console.log("T20%  = estimated probability of a top-20 finish");
console.log("Own%  = projected pool ownership (% of entries picking this player)");
console.log("Lev   = leverage ratio (T20% / Own%) — higher = more underowned relative to talent");
