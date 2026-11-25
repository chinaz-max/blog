// Shared by the static build and the browser; no server secrets or dependencies.
export const GAME_SOURCES = {
    epic: "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=zh-CN&country=CN&allowCountries=CN",
    steam: "https://www.gamerpower.com/api/giveaways?platform=steam&type=game&sort-by=date",
};
export const SOURCE_LINKS = {
    epic: "https://store.epicgames.com/zh-CN/free-games",
    steam: "https://www.gamerpower.com/giveaways/steam",
};
const obj = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const str = (value, max = 500) => typeof value === "string" ? value.slice(0, max).trim() : "";
const list = value => Array.isArray(value) ? value : [];
// Do not silently convert an upstream date with an unspecified timezone to Beijing.
export function utcTime(value) {
    return typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}
export function checkedLink(value, kind) {
    try {
        const url = new URL(str(value, 2048));
        if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
        if (kind === "image") return ["cdn1.epicgames.com", "cdn2.unrealengine.com", "www.gamerpower.com", "gamerpower.com"].includes(url.hostname) ? url.href : null;
        if (kind === "epic" && url.hostname === "store.epicgames.com" && /^\/zh-CN\/(p\/|free-games)/.test(url.pathname)) return url.href;
        if (kind === "steam" && ((url.hostname === "store.steampowered.com" && /^\/(app|sub)\/\d+/.test(url.pathname)) || (["www.gamerpower.com", "gamerpower.com"].includes(url.hostname) && url.pathname.startsWith("/")))) return url.href;
    } catch { /* Invalid URLs are never rendered as links. */ }
    return null;
}
/** @returns {import('./free-games-types').Game[]} */
export function normalizeEpic(value, now = Date.now()) {
    const elements = value?.data?.Catalog?.searchStore?.elements;
    if (!Array.isArray(elements)) throw new Error("Invalid Epic response");
    const games = new Map();
    for (const item of elements.slice(0, 200)) {
        if (!item || !["BASE_GAME", "BUNDLE"].includes(item.offerType) || item.status !== "ACTIVE") continue;
        const price = obj(item.price?.totalPrice);
        // Permanent free-to-play games and free loot promotions are not free-to-keep offers.
        if (!(price.originalPrice > 0)) continue;
        const mappings = [...list(item.offerMappings), ...list(item.catalogNs?.mappings)];
        const slug = str(mappings.find(mapping => mapping.pageType === "productHome")?.pageSlug || item.productSlug?.replace(/\/home$/, ""), 200);
        const url = /^[a-zA-Z0-9_-]+$/.test(slug) ? `https://store.epicgames.com/zh-CN/p/${slug}` : SOURCE_LINKS.epic;
        for (const [field, upcoming] of [["promotionalOffers", false], ["upcomingPromotionalOffers", true]]) {
            for (const group of list(item.promotions?.[field])) for (const promo of list(group.promotionalOffers)) {
                const startAt = utcTime(promo.startDate), endAt = utcTime(promo.endDate);
                if (!startAt || !endAt || Date.parse(endAt) <= now || Date.parse(endAt) <= Date.parse(startAt)) continue;
                if (promo.discountSetting?.discountType !== "PERCENTAGE" || promo.discountSetting.discountPercentage !== 0) continue;
                if (!upcoming && (price.discountPrice !== 0 || Date.parse(startAt) > now)) continue;
                const id = `${str(item.id, 80)}-${startAt}`;
                if (!str(item.title, 180) || !str(item.id, 80)) continue;
                const image = list(item.keyImages).find(image => image.type === "OfferImageWide") || list(item.keyImages)[0];
                games.set(id, { id, title: str(item.title, 180), url, image: checkedLink(image?.url, "image"),
                    startAt, endAt, upcoming, kind: "store", note: "国区活动 · 领取后入库", instructions: "", deadlineUnknown: false });
            }
        }
    }
    return [...games.values()].sort((a, b) => Number(a.upcoming) - Number(b.upcoming) || Date.parse(a.endAt) - Date.parse(b.endAt)).slice(0, 8);
}
/** @returns {import('./free-games-types').Game[]} */
export function normalizeSteam(value, now = Date.now()) {
    if (obj(value).status === 201 && typeof obj(value).status_message === "string") return [];
    if (!Array.isArray(value)) throw new Error("Invalid Steam giveaway response");
    const games = new Map();
    for (const item of value.slice(0, 200)) {
        if (!item || item.type !== "Game" || item.status !== "Active" || !str(item.platforms).split(",").some(platform => platform.trim() === "Steam")) continue;
        const title = str(item.title, 180), description = str(item.description, 2000);
        if (!title || /\b(demo|beta|playtest|free weekend|free to play|free-to-play|trial|DLC)\b/i.test(title + " " + description)) continue;
        const endAt = utcTime(item.end_date);
        if (endAt && Date.parse(endAt) <= now) continue;
        const id = String(item.id);
        if (!/^\d+$/.test(id)) continue;
        const url = checkedLink(item.open_giveaway_url, "steam") || checkedLink(item.gamerpower_url, "steam");
        if (!url) continue;
        const key = /\bkeys?\b/i.test(title + " " + description);
        const direct = new URL(url).hostname === "store.steampowered.com";
        const instructions = str(item.instructions, 3000);
        const arp = instructions.match(/(\d+)\s*ARP/i)?.[1];
        const note = key ? (arp ? `第三方 Key · 需账号及 ${arp} ARP` : "第三方 Key · 请查看领取条件") : direct ? "Steam 商店限免" : "赠送活动 · 请查看领取条件";
        games.set(id, { id, title, url, image: checkedLink(item.image || item.thumbnail, "image"), startAt: null, endAt,
            upcoming: false, kind: key ? "key" : "store", note, instructions, deadlineUnknown: !endAt });
    }
    return [...games.values()].sort((a, b) => (Date.parse(a.endAt || "") || Infinity) - (Date.parse(b.endAt || "") || Infinity)).slice(0, 8);
}
/** @returns {import('./free-games-types').GameDataset} */
export function normalizeDataset(value, platform, now = Date.now()) {
    if (!value || !utcTime(value.fetchedAt) || Date.parse(value.fetchedAt) > now + 60_000 || !Array.isArray(value.games)) throw new Error("Invalid games snapshot");
    const games = [];
    for (const game of value.games.slice(0, 8)) {
        if (!game || !str(game.id, 120) || !str(game.title, 180)) continue;
        const url = checkedLink(game.url, platform);
        if (!url) continue;
        const endAt = utcTime(game.endAt), startAt = utcTime(game.startAt);
        if (platform === "epic" && (!endAt || !startAt)) continue;
        games.push({ id: str(game.id, 120), title: str(game.title, 180), url, image: checkedLink(game.image, "image"),
            startAt, endAt, upcoming: game.upcoming === true, kind: game.kind === "key" ? "key" : "store",
            note: str(game.note, 140), instructions: str(game.instructions, 3000), deadlineUnknown: !endAt });
    }
    return { fetchedAt: String(utcTime(value.fetchedAt)), games };
}
/** @param {import('./free-games-types').GameDataset | undefined} dataset
 * @returns {import('./free-games-types').Game[]} */
export function visibleGames(dataset, now = Date.now()) {
    if (!dataset || now - Date.parse(dataset.fetchedAt) > 24 * 60 * 60_000 || Date.parse(dataset.fetchedAt) > now + 60_000) return [];
    return dataset.games.filter(game => !game.endAt || Date.parse(game.endAt) > now);
}
/** @param {import('./free-games-types').Game} game
 * @param {import('./free-games-types').GameDataset | undefined} dataset */
export function gameState(game, dataset, now = Date.now()) {
    if (game.endAt && Date.parse(game.endAt) <= now) return { label: "已结束", action: "查看活动", kind: "ended" };
    if (game.startAt && Date.parse(game.startAt) > now) return { label: "即将免费", action: "查看预告", kind: "upcoming" };
    if (game.upcoming || !dataset || now - Date.parse(dataset.fetchedAt) > 2 * 60 * 60_000) return { label: "待核对", action: "前往核对", kind: "check" };
    return game.kind === "key" ? { label: "Key 赠送", action: "查看领取条件", kind: "key" } : { label: "限时免费", action: "前往领取", kind: "active" };
}
export function beijingDate(value) {
    return utcTime(value) ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value)) : "未公布";
}
