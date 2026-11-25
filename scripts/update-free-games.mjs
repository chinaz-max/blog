import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { GAME_SOURCES, normalizeEpic, normalizeSteam } from "../src/utils/free-games.js";

export async function refreshGames(previous, request = fetch, now = Date.now()) {
    const snapshot = { version: 1 };
    const results = await Promise.allSettled(Object.entries(GAME_SOURCES).map(async ([key, url]) => {
        const response = await request(url, { signal: AbortSignal.timeout(18_000), headers: { "User-Agent": "ChuzunBlog-FreeGames/1.0" } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const raw = await response.text();
        if (raw.length > 2_000_000) throw new Error("Oversized games response");
        const payload = JSON.parse(raw);
        const games = key === "epic" ? normalizeEpic(payload, now) : normalizeSteam(payload, now);
        return [key, { fetchedAt: new Date(now).toISOString(), games }];
    }));
    Object.keys(GAME_SOURCES).forEach((key, index) => {
        const result = results[index];
        if (result.status === "fulfilled") snapshot[key] = result.value[1];
        else {
            if (previous?.[key]) snapshot[key] = previous[key];
            console.warn(`${key}: ${result.reason?.message || "source error"}; kept previous snapshot and timestamp`);
        }
    });
    return snapshot;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const path = fileURLToPath(new URL("../public/data/free-games.json", import.meta.url));
    let previous = { version: 1 };
    try { previous = JSON.parse(readFileSync(path, "utf8")); } catch { /* First build starts empty. */ }
    const snapshot = await refreshGames(previous);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path + ".tmp", JSON.stringify(snapshot, null, 2) + "\n");
    renameSync(path + ".tmp", path);
    console.log(`Free games: Epic ${snapshot.epic?.games.length ?? "not checked"}; Steam ${snapshot.steam?.games.length ?? "not checked"}`);
}
