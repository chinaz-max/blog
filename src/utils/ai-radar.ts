import { normalizeTiboFeed, TIBO_FEED_URL } from "./tibo-feed.ts";

export const SOURCES = {
    status: "https://codex-resets.com/api/v1/status",
    history: "https://codex-resets.com/api/v1/resets?limit=100",
    tibo: TIBO_FEED_URL,
} as const;
export type DatasetKey = keyof typeof SOURCES;
export type Dataset = { fetchedAt: string; payload: unknown };
export type RadarSnapshot = { version: 1 } & Partial<Record<DatasetKey, Dataset>>;
export type JsonRecord = Record<string, unknown>;
export const record = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
export const text = (value: unknown, limit = 350) => typeof value === "string" ? value.slice(0, limit) : "";
export const timestamp = (value: unknown) => typeof value === "string" ? Date.parse(value) : Number.NaN;
export function sourceLink(value: unknown): string | null {
    try {
        const url = new URL(text(value, 2048));
        return url.protocol === "https:" && ["x.com", "twitter.com", "github.com", "codex-resets.com"].includes(url.hostname) ? url.href : null;
    } catch { return null; }
}
export function normalizePayload(key: DatasetKey, value: unknown): unknown {
    if (key === "tibo") return normalizeTiboFeed(value);
    const payload = record(value);
    if (key === "history") {
        if (!Array.isArray(payload.data)) throw new Error("Invalid history");
        return { data: payload.data.slice(0, 100).map(value => {
            const entry = record(value);
            return Object.fromEntries(["id", "reset_type", "announced_at", "source"].map(field => [field, entry[field]]));
        }), meta: payload.meta };
    }
    if (key === "status") {
        if (!("latest_reset" in record(payload.data))) throw new Error("Invalid status");
        return { data: payload.data, meta: payload.meta };
    }
    throw new Error("Unknown radar source");
}
export function fresh(dataset: Dataset | undefined, now: number, ttl = 20 * 60_000) {
    if (!dataset) return false;
    const times = [timestamp(dataset.fetchedAt)];
    const generated = record(record(dataset.payload).meta).generated_at;
    if (generated !== undefined) times.push(timestamp(generated));
    const feedTime = record(dataset.payload).fetched_at;
    if (feedTime !== undefined) times.push(timestamp(feedTime));
    return times.every(time => Number.isFinite(time) && now - time >= -60_000 && now - time <= ttl);
}
export function beijingTime(value: unknown, withYear = false) {
    const time = timestamp(value);
    return Number.isFinite(time) ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: withYear ? "numeric" : undefined, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(time) : "时间未提供";
}
export function getSignal(snapshot: RadarSnapshot, now = Date.now()) {
    const data = record(record(snapshot.status?.payload).data);
    const empty = { kind: "waiting", title: "等下一次好消息", label: "等待预告", description: "尚无确定的下次重置时间。", until: null as string | null, evidence: "", link: null as string | null };
    if (!snapshot.status) return { ...empty, kind: "unavailable", title: "暂时无法获取动态", label: "等待更新", description: "可通过下方来源查看最新消息。" };
    if (!fresh(snapshot.status, now)) return { ...empty, kind: "stale", title: "动态需要重新核对", label: "缓存已过期", description: "保留历史记录，暂停展示旧预测。" };
    const scheduled = record(data.scheduled_reset);
    if (Object.keys(scheduled).length) {
        const at = timestamp(scheduled.scheduled_for);
        const passed = Number.isFinite(at) && at <= now;
        return { ...empty, kind: passed ? "waiting" : "announced", title: passed ? "预告时间已过，等待确认" : "有新的重置预告", label: "公开预告", description: passed ? "时间已过不代表重置已完成。" : "具体范围与时间以原始公告为准。", until: Number.isFinite(at) && !passed ? text(scheduled.scheduled_for) : null, evidence: text(scheduled.text), link: sourceLink(record(scheduled.source).url) };
    }
    const watch = record(data.active_watch);
    const expires = timestamp(watch.expires_at);
    const observed = timestamp(watch.observed_at);
    if (Number.isFinite(expires) && expires > now && Number.isFinite(observed) && observed <= now + 60_000) {
        return { ...empty, kind: "prediction", title: "近期可能有一次重置", label: "社区预测 · 非官方", description: "这是社区观察窗口，尚无确定的重置承诺。", until: text(watch.expires_at), evidence: text(watch.text), link: sourceLink(record(watch.source).url) || "https://codex-resets.com/" };
    }
    return empty;
}
export function calendarDays(dataset: Dataset | undefined, now = Date.now()) {
    const raw = record(dataset?.payload).data;
    const entries = Array.isArray(raw) ? raw.map(record) : [];
    const dayKey = (time: number) => new Date(time + 8 * 60 * 60_000).toISOString().slice(0, 10);
    const end = dayKey(now);
    const midnight = Date.parse(`${end}T00:00:00+08:00`);
    return Array.from({ length: 28 }, (_, index) => {
        const date = dayKey(midnight - (27 - index) * 86_400_000);
        const events = entries.filter(event => Number.isFinite(timestamp(event.announced_at)) && timestamp(event.announced_at) <= now && dayKey(timestamp(event.announced_at)) === date);
        const regular = events.some(event => event.reset_type === "regular");
        const banked = events.some(event => event.reset_type === "banked");
        return { date, type: regular && banked ? "both" : regular ? "regular" : banked ? "banked" : "none", count: events.length, link: sourceLink(record(events[0]?.source).url) };
    });
}
