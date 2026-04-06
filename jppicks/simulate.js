const fs = require("fs");
const path = require("path");

const SIMS = 1_000_000;
const NUM_ENTRIES = 14;
const PICKS_PER_ENTRY = 6;

// --- Load odds data ---
const oddsData = JSON.parse(fs.readFileSync(path.join(__dirname, "odds2026.json"), "utf8")).odds;
const purseData = fs.readFileSync(path.join(__dirname, "..", "purse.csv"), "utf8")
    .trim().split("\n").slice(1)
    .map(line => parseInt(line.split(",")[1], 10));

// --- Player pool with win probabilities ---

function impliedProb(americanOdds) {
    return 100 / (americanOdds + 100);
}

// Build probability-weighted player list
const players = oddsData.map(p => ({
    name: p.player,
    odds: p.odds,
    tier: p.tier,
    winProb: impliedProb(p.odds)
}));

// Normalize win probs to sum to 1
const totalProb = players.reduce((s, p) => s + p.winProb, 0);
players.forEach(p => p.normProb = p.winProb / totalProb);

// --- 2023-style chalk picks (what most entries will look like) ---
// From 2023 data: entries heavily cluster on top-odds players
// Ownership rates from 2023 pool
const chalkPool = [
    { name: "Scottie Scheffler", weight: 86 },
    { name: "Rory McIlroy", weight: 79 },
    { name: "Jon Rahm", weight: 64 },
    { name: "Bryson DeChambeau", weight: 60 },
    { name: "Ludvig Åberg", weight: 55 },
    { name: "Xander Schauffele", weight: 45 },
    { name: "Collin Morikawa", weight: 40 },
    { name: "Patrick Cantlay", weight: 40 },
    { name: "Jordan Spieth", weight: 35 },
    { name: "Corey Conners", weight: 35 },
    { name: "Cameron Young", weight: 30 },
    { name: "Tommy Fleetwood", weight: 25 },
    { name: "Justin Thomas", weight: 25 },
    { name: "Cameron Smith", weight: 20 },
    { name: "Max Homa", weight: 20 },
    { name: "Jason Day", weight: 18 },
    { name: "Matt Fitzpatrick", weight: 15 },
    { name: "Sam Burns", weight: 12 },
    { name: "Hideki Matsuyama", weight: 12 },
    { name: "Viktor Hovland", weight: 10 },
    { name: "Dustin Johnson", weight: 10 },
    { name: "Justin Rose", weight: 8 },
    { name: "Tony Finau", weight: 8 },
    { name: "Brooks Koepka", weight: 8 },
    { name: "Shane Lowry", weight: 6 },
    { name: "Robert MacIntyre", weight: 5 },
    { name: "Sungjae Im", weight: 5 },
    { name: "Adam Scott", weight: 4 }
];

const chalkTotalWeight = chalkPool.reduce((s, p) => s + p.weight, 0);

// --- Our contrarian entry (Build 1 from analyze.js) ---
const ourPicks = [
    "Scottie Scheffler",
    "Matt Fitzpatrick",
    "Xander Schauffele",
    "Hideki Matsuyama",
    "Justin Rose",
    "Robert MacIntyre"
];

// --- Simulation helpers ---

function generateChalkEntry() {
    // Pick 6 players weighted by chalk ownership rates
    // Mimics how casual pool entrants pick: heavily favor favorites with some variation
    const picks = [];
    const available = chalkPool.map(p => ({ ...p }));

    for (let i = 0; i < PICKS_PER_ENTRY; i++) {
        const totalW = available.reduce((s, p) => s + p.weight, 0);
        let r = Math.random() * totalW;
        let chosen = 0;
        for (let j = 0; j < available.length; j++) {
            r -= available[j].weight;
            if (r <= 0) { chosen = j; break; }
        }
        picks.push(available[chosen].name);
        available.splice(chosen, 1);
    }
    return picks;
}

function simulateTournament() {
    // Generate finishing order weighted by win probability
    // Assign positions 1-N based on shuffled probability-weighted ranking
    const results = {};
    const shuffled = players.map(p => ({
        name: p.name,
        score: -Math.log(Math.random()) / p.normProb  // exponential racing model
    })).sort((a, b) => a.score - b.score);

    shuffled.forEach((p, i) => {
        const pos = i + 1;
        results[p.name] = pos;
    });

    return results;
}

function calculatePayout(position) {
    if (position > 50 || position < 1) return 0;
    return purseData[position - 1] || 0;
}

function entryMoney(picks, results) {
    return picks.reduce((total, name) => {
        const pos = results[name];
        if (!pos) return total;
        return total + calculatePayout(pos);
    }, 0);
}

// --- Run simulation ---

console.log("=== MASTERS POOL MONTE CARLO SIMULATION ===\n");
console.log(`Simulations: ${SIMS.toLocaleString()}`);
console.log(`Entries: ${NUM_ENTRIES} chalk + 1 contrarian (ours)`);
console.log(`Picks per entry: ${PICKS_PER_ENTRY}\n`);
console.log("Our picks: " + ourPicks.join(", ") + "\n");
console.log("Running...\n");

let ourWins1st = 0;
let ourWins2nd = 0;
let ourTop2 = 0;
let totalEntries = NUM_ENTRIES + 1;
let ourAvgMoney = 0;
let chalkAvgMoney = 0;
let ourMoneyWhenWin = 0;

// Track how often each build wins
const buildResults = {
    contrarian: { wins1st: 0, wins2nd: 0 }
};

const startTime = Date.now();

for (let sim = 0; sim < SIMS; sim++) {
    const results = simulateTournament();

    // Generate chalk entries
    const chalkEntries = [];
    for (let i = 0; i < NUM_ENTRIES; i++) {
        chalkEntries.push(generateChalkEntry());
    }

    // Score all entries
    const ourMoney = entryMoney(ourPicks, results);
    const allScores = chalkEntries.map((picks, i) => ({
        id: "chalk" + i,
        money: entryMoney(picks, results)
    }));
    allScores.push({ id: "ours", money: ourMoney });

    // Sort by money descending
    allScores.sort((a, b) => b.money - a.money);

    ourAvgMoney += ourMoney;
    chalkEntries.forEach(picks => {
        chalkAvgMoney += entryMoney(picks, results);
    });

    if (allScores[0].id === "ours") {
        ourWins1st++;
        ourMoneyWhenWin += ourMoney;
    }
    if (allScores[1].id === "ours") {
        ourWins2nd++;
    }
    if (allScores[0].id === "ours" || allScores[1].id === "ours") {
        ourTop2++;
    }
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

ourAvgMoney /= SIMS;
chalkAvgMoney /= (SIMS * NUM_ENTRIES);
const fairShare = 1 / totalEntries;

console.log(`Completed in ${elapsed}s\n`);
console.log("--- RESULTS ---\n");
console.log(`Our 1st place win rate:   ${(ourWins1st / SIMS * 100).toFixed(2)}%  (${ourWins1st.toLocaleString()} wins)`);
console.log(`Our 2nd place rate:       ${(ourWins2nd / SIMS * 100).toFixed(2)}%  (${ourWins2nd.toLocaleString()} times)`);
console.log(`Our top-2 rate:           ${(ourTop2 / SIMS * 100).toFixed(2)}%  (${ourTop2.toLocaleString()} times)`);
console.log(`Fair share (1/${totalEntries}):        ${(fairShare * 100).toFixed(2)}%`);
console.log(`Edge over fair share:     ${((ourWins1st / SIMS - fairShare) / fairShare * 100).toFixed(1)}%\n`);

console.log(`Our avg prize money:      $${Math.round(ourAvgMoney).toLocaleString()}`);
console.log(`Chalk avg prize money:    $${Math.round(chalkAvgMoney).toLocaleString()}`);
console.log(`Our avg when we win 1st:  $${Math.round(ourMoneyWhenWin / Math.max(ourWins1st, 1)).toLocaleString()}\n`);

const entryFee = 40;
const pot = totalEntries * entryFee;
const ev1st = ourWins1st / SIMS * pot * 0.85;
const ev2nd = ourWins2nd / SIMS * pot * 0.15;
const totalEV = ev1st + ev2nd;

console.log("--- EXPECTED VALUE ---\n");
console.log(`Pool pot (${totalEntries} × $${entryFee}):    $${pot}`);
console.log(`EV from 1st place:        $${ev1st.toFixed(2)}`);
console.log(`EV from 2nd place:        $${ev2nd.toFixed(2)}`);
console.log(`Total EV per entry:       $${totalEV.toFixed(2)}`);
console.log(`Entry fee:                $${entryFee}`);
console.log(`Net EV:                   $${(totalEV - entryFee).toFixed(2)}`);
console.log(`ROI:                      ${((totalEV / entryFee - 1) * 100).toFixed(1)}%\n`);

// Compare: what if we just picked chalk?
console.log("--- COMPARISON: IF WE PICKED CHALK ---\n");
console.log(`Chalk 1st place win rate: ${((SIMS - ourWins1st) / SIMS / NUM_ENTRIES * 100).toFixed(2)}% (avg per chalk entry)`);
console.log(`Chalk avg prize money:    $${Math.round(chalkAvgMoney).toLocaleString()}`);
const chalkWinRate = (SIMS - ourWins1st) / SIMS / NUM_ENTRIES;
const chalkEV = chalkWinRate * pot * 0.85 + chalkWinRate * pot * 0.15;
console.log(`Chalk EV per entry:       $${chalkEV.toFixed(2)}`);
console.log(`Our edge vs chalk:        $${(totalEV - chalkEV).toFixed(2)} per entry`);
