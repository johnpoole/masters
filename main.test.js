const {
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
} = require("./main");

// --- Test fixtures ---

function makeLeaderboard() {
    return [
        { position: 1, first_name: "Jon", last_name: "Rahm", status: "active" },
        { position: 2, first_name: "Scottie", last_name: "Scheffler", status: "active" },
        { position: 2, first_name: "Rory", last_name: "McIlroy", status: "active" },
        { position: 4, first_name: "Jordan", last_name: "Spieth", status: "active" },
        { position: 55, first_name: "Tiger", last_name: "Woods", status: "active" },
        { position: 10, first_name: "Dustin", last_name: "Johnson", status: "cut" }
    ];
}

function makePurse() {
    const amounts = [];
    for (let i = 0; i < 50; i++) {
        amounts.push({ amount: String((50 - i) * 10000) });
    }
    return amounts;
}

function makePoolData() {
    return [
        {
            name: "Alice",
            pick1: "Jon Rahm", pick2: "Scottie Scheffler",
            pick3: "Rory McIlroy", pick4: "Jordan Spieth",
            pick5: "Jon Rahm", pick6: "Jordan Spieth"
        }
    ];
}

function makePoolEntry(overrides) {
    var base = {
        name: "Bob",
        pick1: "Jon Rahm", pick2: "Jon Rahm",
        pick3: "Jon Rahm", pick4: "Jon Rahm",
        pick5: "Jon Rahm", pick6: "Jon Rahm"
    };
    return [Object.assign(base, overrides)];
}

// --- pool rules ---

describe("pool rules", () => {
    test("6 picks per entry", () => {
        expect(NUM_PICKS).toBe(6);
    });

    test("$40 entry fee", () => {
        expect(ENTRY_FEE).toBe(40);
    });

    test("85/15 payout split totals 100%", () => {
        expect(FIRST_PLACE_PCT + SECOND_PLACE_PCT).toBe(1);
    });
});

// --- normalizeName ---

describe("normalizeName", () => {
    test("trims whitespace", () => {
        expect(normalizeName("  Jon Rahm  ")).toBe("jon rahm");
    });

    test("collapses internal whitespace", () => {
        expect(normalizeName("Jon   Rahm")).toBe("jon rahm");
    });

    test("lowercases", () => {
        expect(normalizeName("JON RAHM")).toBe("jon rahm");
    });

    test("handles tabs and mixed whitespace", () => {
        expect(normalizeName(" Jon\t Rahm ")).toBe("jon rahm");
    });
});

// --- processPlayers ---

describe("processPlayers", () => {
    test("creates Player field from first_name and last_name", () => {
        const players = processPlayers([
            { first_name: "Jon", last_name: "Rahm", position: 1 }
        ]);
        expect(players[0].Player).toBe("Jon Rahm");
    });

    test("trims outer whitespace from Player field", () => {
        const players = processPlayers([
            { first_name: " Jon ", last_name: " Rahm ", position: 1 }
        ]);
        // " Jon " + " " + " Rahm " = " Jon   Rahm ", trimmed = "Jon   Rahm"
        // Internal whitespace preserved — normalizeName handles collapsing later
        expect(players[0].Player).toBe("Jon   Rahm");
    });

    test("preserves original fields", () => {
        const players = processPlayers([
            { first_name: "Jon", last_name: "Rahm", position: 1, status: "active" }
        ]);
        expect(players[0].position).toBe(1);
        expect(players[0].status).toBe("active");
    });

    test("initializes purse to 0", () => {
        const players = processPlayers([
            { first_name: "Jon", last_name: "Rahm", position: 1 }
        ]);
        expect(players[0].purse).toBe(0);
    });
});

// --- buildPlayerIndex ---

describe("buildPlayerIndex", () => {
    test("builds a map keyed by normalized name", () => {
        const players = processPlayers(makeLeaderboard());
        const index = buildPlayerIndex(players);
        expect(index.get("jon rahm").Player).toBe("Jon Rahm");
        expect(index.get("scottie scheffler").Player).toBe("Scottie Scheffler");
    });

    test("throws on duplicate player names", () => {
        const players = [
            { Player: "Jon Rahm" },
            { Player: "Jon Rahm" }
        ];
        expect(() => buildPlayerIndex(players)).toThrow("Duplicate player name");
    });
});

// --- findPlayer ---

describe("findPlayer", () => {
    test("finds player by normalized name", () => {
        const players = processPlayers(makeLeaderboard());
        const index = buildPlayerIndex(players);
        const p = findPlayer(index, "  jon rahm  ", "TestEntry", 1);
        expect(p.Player).toBe("Jon Rahm");
    });

    test("is case-insensitive", () => {
        const players = processPlayers(makeLeaderboard());
        const index = buildPlayerIndex(players);
        const p = findPlayer(index, "JON RAHM", "TestEntry", 1);
        expect(p.Player).toBe("Jon Rahm");
    });

    test("throws with context when player not found", () => {
        const players = processPlayers(makeLeaderboard());
        const index = buildPlayerIndex(players);
        expect(() => findPlayer(index, "Nobody Real", "Alice", 3))
            .toThrow("Unmatched pick: 'Nobody Real' (pick3 for Alice)");
    });
});

// --- validateAllPicks ---

describe("validateAllPicks", () => {
    test("passes when all picks match", () => {
        const players = processPlayers(makeLeaderboard());
        const index = buildPlayerIndex(players);
        const pool = makePoolData();
        expect(() => validateAllPicks(pool, index)).not.toThrow();
    });

    test("throws listing all unmatched picks", () => {
        const players = processPlayers(makeLeaderboard());
        const index = buildPlayerIndex(players);
        const pool = makePoolEntry({
            pick1: "Fake Player", pick3: "Also Fake"
        });
        expect(() => validateAllPicks(pool, index)).toThrow("2 unmatched pick(s)");
    });

    test("throws on empty picks", () => {
        const players = processPlayers(makeLeaderboard());
        const index = buildPlayerIndex(players);
        const pool = makePoolEntry({ pick1: "" });
        expect(() => validateAllPicks(pool, index)).toThrow("empty pick");
    });

    test("collects errors across multiple pool entries", () => {
        const players = processPlayers(makeLeaderboard());
        const index = buildPlayerIndex(players);
        const pool = [
            ...makePoolEntry({ name: "Alice", pick1: "Nobody" }),
            ...makePoolEntry({ name: "Bob", pick6: "Also Nobody" })
        ];
        expect(() => validateAllPicks(pool, index)).toThrow("2 unmatched pick(s)");
    });
});

// --- calcPayouts ---

describe("calcPayouts", () => {
    test("assigns full purse for solo positions", () => {
        const players = processPlayers([
            { position: 1, first_name: "Jon", last_name: "Rahm", status: "active" }
        ]);
        const purse = makePurse();
        const payouts = calcPayouts(purse, players);
        expect(payouts[1]).toBe(500000); // position 1 = (50-0)*10000
    });

    test("includes position 50 in payouts", () => {
        const players = processPlayers([
            { position: 50, first_name: "Tiger", last_name: "Woods", status: "active" }
        ]);
        const purse = makePurse();
        const payouts = calcPayouts(purse, players);
        expect(payouts[50]).toBe(10000); // (50-49)*10000
    });

    test("tie at position 49 splits positions 49 and 50 only", () => {
        const players = processPlayers([
            { position: 49, first_name: "A", last_name: "Player", status: "active" },
            { position: 49, first_name: "B", last_name: "Player2", status: "active" },
            { position: 49, first_name: "C", last_name: "Player3", status: "active" }
        ]);
        const purse = makePurse();
        const payouts = calcPayouts(purse, players);
        // 3-way tie at 49: only positions 49 and 50 have purse values (20000 + 10000)
        // Split 30000 across 3 = 10000 each
        expect(payouts[49]).toBe(10000);
    });

    test("splits purse evenly for tied positions", () => {
        const players = processPlayers([
            { position: 2, first_name: "Scottie", last_name: "Scheffler", status: "active" },
            { position: 2, first_name: "Rory", last_name: "McIlroy", status: "active" }
        ]);
        const purse = makePurse();
        const payouts = calcPayouts(purse, players);
        // Position 2: purse[1]=490000, Position 3: purse[2]=480000
        // Split: (490000 + 480000) / 2 = 485000
        expect(payouts[2]).toBe(485000);
    });
});

// --- calculatePurse ---

describe("calculatePurse", () => {
    test("returns payout for active player with valid position", () => {
        const payouts = [];
        payouts[1] = 500000;
        expect(calculatePurse({ position: 1, status: "active" }, payouts)).toBe(500000);
    });

    test("returns 0 for cut players", () => {
        const payouts = [];
        payouts[10] = 100000;
        expect(calculatePurse({ position: 10, status: "cut" }, payouts)).toBe(0);
    });

    test("returns payout for position 50", () => {
        const payouts = [];
        payouts[50] = 59000;
        expect(calculatePurse({ position: 50, status: "active" }, payouts)).toBe(59000);
    });

    test("returns 0 for position > 50", () => {
        const payouts = [];
        payouts[51] = 10000;
        expect(calculatePurse({ position: 51, status: "active" }, payouts)).toBe(0);
    });

    test("returns 0 when no payout exists for position", () => {
        expect(calculatePurse({ position: 3, status: "active" }, [])).toBe(0);
    });
});

// --- estimateMoney ---

describe("estimateMoney", () => {
    test("sums purse for all picks", () => {
        const payouts = [];
        payouts[1] = 500000;
        payouts[4] = 200000;
        const picks = [
            { position: 1, status: "active" },
            { position: 4, status: "active" }
        ];
        expect(estimateMoney(picks, payouts)).toBe(700000);
    });

    test("returns 0 for empty picks", () => {
        expect(estimateMoney([], [])).toBe(0);
    });
});

// --- buildNodes ---

describe("buildNodes", () => {
    test("creates golfer nodes with money", () => {
        const players = processPlayers([
            { position: 1, first_name: "Jon", last_name: "Rahm", status: "active" }
        ]);
        const payouts = [];
        payouts[1] = 500000;
        const nodes = buildNodes(players, payouts);
        expect(nodes).toHaveLength(1);
        expect(nodes[0].id).toBe("Jon Rahm");
        expect(nodes[0].golfer).toBe(true);
        expect(nodes[0].money).toBe(500000);
    });
});


// --- enrichPicks ---

describe("enrichPicks", () => {
    test("creates pool entry nodes with picks and money", () => {
        const players = processPlayers(makeLeaderboard());
        const index = buildPlayerIndex(players);
        const purse = makePurse();
        const payouts = calcPayouts(purse, players);
        const pool = makePoolData();
        const nodes = enrichPicks(pool, index, payouts);
        expect(nodes).toHaveLength(1);
        expect(nodes[0].id).toBe("Alice");
        expect(nodes[0].picks).toHaveLength(NUM_PICKS);
        expect(nodes[0].money).toBeGreaterThan(0);
    });

    test("throws when a pick doesn't match", () => {
        const players = processPlayers(makeLeaderboard());
        const index = buildPlayerIndex(players);
        const pool = makePoolEntry({ pick1: "Ghost Player" });
        expect(() => enrichPicks(pool, index, [])).toThrow("Unmatched pick");
    });
});

// --- textDisplay ---

describe("textDisplay", () => {
    test("shows position in parentheses for active player", () => {
        expect(textDisplay({ Player: "Jon Rahm", position: 1 })).toBe("Jon Rahm(1)");
    });

    test("strikes through player with no position", () => {
        expect(textDisplay({ Player: "Jon Rahm", position: 0 }))
            .toBe("<strike>Jon Rahm</strike>");
    });

    test("strikes through player with undefined position", () => {
        expect(textDisplay({ Player: "Jon Rahm" }))
            .toBe("<strike>Jon Rahm</strike>");
    });
});
