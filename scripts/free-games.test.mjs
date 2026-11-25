import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { beijingDate, BROWSER_GAME_SOURCES, checkedLink, gameState, normalizeCommunityEpic, normalizeDataset, normalizeEpic, normalizeSteam, utcTime, visibleGames } from "../src/utils/free-games.js";
import { refreshGames } from "./update-free-games.mjs";

const now = Date.parse("2026-11-25T12:00:00Z");
const at = offset => new Date(now + offset).toISOString();
const promo = (percentage = 0, start = -60_000, end = 60_000) => ({ startDate: at(start), endDate: at(end), discountSetting: { discountType: "PERCENTAGE", discountPercentage: percentage } });
const epic = (extra = {}) => ({ id: "abc", title: "Free game", offerType: "BASE_GAME", status: "ACTIVE", offerMappings: [{ pageType: "productHome", pageSlug: "free-game" }], price: { totalPrice: { originalPrice: 1000, discountPrice: 0 } }, promotions: { promotionalOffers: [{ promotionalOffers: [promo()] }], upcomingPromotionalOffers: [] }, ...extra });
const epicPayload = items => ({ data: { Catalog: { searchStore: { elements: items } } } });
const steam = (extra = {}) => ({ id: 1, title: "A game (Steam) Giveaway", type: "Game", status: "Active", platforms: "PC, Steam", end_date: "N/A", open_giveaway_url: "https://www.gamerpower.com/open/a-game", instructions: "Read conditions", ...extra });
const dataset = games => ({ fetchedAt: at(0), games });

test("Epic only accepts real zero-price timed promotions, not discounts or free-to-play", () => {
    const games = normalizeEpic(epicPayload([epic(), epic({ id: "f2p", price: { totalPrice: { originalPrice: 0, discountPrice: 0 } } }),
        epic({ id: "dlc", offerType: "ADD_ON" }), epic({ id: "paid", price: { totalPrice: { originalPrice: 1000, discountPrice: 100 } } }),
        epic({ id: "discount", promotions: { promotionalOffers: [{ promotionalOffers: [promo(40)] }] } }),
        epic({ id: "ended", promotions: { promotionalOffers: [{ promotionalOffers: [promo(0, -120_000, -1)] }] } })]), now);
    assert.equal(games.length, 1);
    assert.equal(games[0].url, "https://store.epicgames.com/zh-CN/p/free-game");
    assert.equal(gameState(games[0], dataset(games), now).kind, "active");
});
test("upcoming Epic stays a preview after its start until the next price verification", () => {
    const games = normalizeEpic(epicPayload([epic({ price: { totalPrice: { originalPrice: 1000, discountPrice: 1000 } }, promotions: { upcomingPromotionalOffers: [{ promotionalOffers: [promo(0, 60_000, 180_000)] }] } })]), now);
    assert.equal(games.length, 1);
    assert.equal(gameState(games[0], dataset(games), now).kind, "upcoming");
    assert.equal(gameState(games[0], dataset(games), now + 60_000).kind, "check");
    assert.equal(visibleGames(dataset(games), now + 180_000).length, 0);
});
test("malformed source data throws while valid empty data clears old offers", () => {
    assert.throws(() => normalizeEpic({ message: "source failed" }, now));
    assert.throws(() => normalizeSteam({ error: "rate limited" }, now));
    assert.deepEqual(normalizeEpic(epicPayload([]), now), []);
    assert.deepEqual(normalizeSteam({ status: 201, status_message: "No active giveaways" }, now), []);
});
test("Steam removes free weekends, DLC, beta, other platforms and inactive offers", () => {
    const data = [steam(), ...[
        { id: 2, title: "Free Weekend" }, { id: 3, title: "Game DLC" }, { id: 4, type: "Loot" },
        { id: 5, type: "Beta" }, { id: 6, platforms: "PC, Epic Games Store" }, { id: 7, status: "Expired" },
        { id: 8, description: "A free-to-play game" }, { id: 9, end_date: at(-1) },
    ].map(extra => steam(extra))];
    assert.deepEqual(normalizeSteam(data, now).map(game => game.id), ["1"]);
});
test("Steam Key requirements remain distinct from direct store claims", () => {
    const games = normalizeSteam([steam({ title: "A Steam Key Giveaway", instructions: "Requires 10 ARP and an account" }), steam({ id: 2, open_giveaway_url: "https://store.steampowered.com/app/12345/" })], now);
    assert.equal(gameState(games[0], dataset(games), now).action, "查看领取条件");
    assert.match(games[0].note, /10 ARP/);
    assert.equal(games[1].note, "Steam 商店限免");
});
test("dates without a timezone never turn into invented Beijing deadlines", () => {
    assert.equal(utcTime("2026-11-27 12:00:00"), null);
    assert.equal(utcTime("N/A"), null);
    assert.equal(beijingDate("2026-11-26T16:00:00Z"), "11/27 00:00");
    assert.equal(normalizeSteam([steam({ end_date: "2026-11-27 12:00:00" })], now)[0].endAt, null);
});
test("untrusted links and images are rejected before rendering", () => {
    for (const url of ["javascript:alert(1)", "https://www.gamerpower.com.evil.test/free", "https://user@www.gamerpower.com/free", "http://www.gamerpower.com/free"]) assert.equal(checkedLink(url, "steam"), null);
    assert.equal(checkedLink("https://evil.test/image.jpg", "image"), null);
    assert.equal(normalizeSteam([steam({ open_giveaway_url: "javascript:alert(1)" })], now).length, 0);
    assert.throws(() => normalizeDataset({ fetchedAt: at(120_000), games: [] }, "steam", now));
});
test("expired and old-cache offers stop being presented as currently claimable", () => {
    const games = normalizeEpic(epicPayload([epic()]), now);
    assert.equal(gameState(games[0], dataset(games), now + 60_000).kind, "ended");
    const data = { ...dataset(games), fetchedAt: at(-3 * 60 * 60_000) };
    assert.equal(gameState(games[0], data, now).kind, "check");
    assert.deepEqual(visibleGames({ ...data, fetchedAt: at(-25 * 60 * 60_000) }, now), []);
});
test("source failure preserves that source's previous timestamp independently", async () => {
    const previous = { version: 1, epic: { fetchedAt: at(-600_000), games: [] }, steam: { fetchedAt: at(-600_000), games: [] } };
    const request = async url => {
        if (url.includes("epicgames")) throw new Error("test offline");
        return { ok: true, text: async () => JSON.stringify([]) };
    };
    const result = await refreshGames(previous, request, now);
    assert.deepEqual(result.epic, previous.epic);
    assert.equal(result.steam.fetchedAt, at(0));
    assert.deepEqual(result.steam.games, []);
});
test("homepage and build switch away from Tibo and browser sources are free public APIs", () => {
    const page = readFileSync(new URL("../src/pages/[...page].astro", import.meta.url), "utf8");
    assert.match(page, /<GameGiveaways\s*\/>/);
    assert.doesNotMatch(page, /<AIRadar/);
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    assert.match(pkg.scripts.build, /update-free-games/);
    assert.match(BROWSER_GAME_SOURCES.epic, /gamerpower.com\/api\/giveaways\?platform=epic-games-store/);
    assert.match(BROWSER_GAME_SOURCES.steam, /platform=steam/);
});

test("community Epic updates preserve official deadlines and do not revive expired games", () => {
    const old = dataset(normalizeEpic(epicPayload([epic()]), now));
    const raw = [steam({ title: "Free game (Epic Games) Giveaway", platforms: "PC, Epic Games Store" })];
    const games = normalizeCommunityEpic(raw, old, now);
    assert.equal(games[0].endAt, at(60_000));
    assert.equal(games[0].url, "https://store.epicgames.com/zh-CN/p/free-game");
    assert.deepEqual(normalizeCommunityEpic(raw, old, now + 60_000), []);
});
