import assert from "node:assert/strict";
import test from "node:test";
import { calendarDays, fresh, getSignal, normalizePayload, sourceLink } from "../src/utils/ai-radar.ts";

const now = Date.parse("2026-09-28T04:00:00Z");
const iso = offset => new Date(now + offset).toISOString();
const snapshot = (overrides = {}) => ({ version: 1, status: { fetchedAt: iso(0), payload: { meta: { generated_at: iso(0) }, data: { latest_reset: null, scheduled_reset: null, active_watch: { observed_at: iso(-60_000), expires_at: iso(60_000), text: "Community observation" }, ...overrides } } } });

test("community forecasts are distinct from announcements and disappear at expiry", () => {
    const data = snapshot();
    assert.equal(getSignal(data, now).kind, "prediction");
    assert.match(getSignal(data, now).label, /非官方/);
    assert.equal(getSignal(data, now + 60_000).kind, "waiting");
    assert.equal(getSignal(data, now + 60_000).until, null);
});

test("fetching an old upstream response does not make its prediction fresh", () => {
    const data = snapshot();
    data.status.payload.meta.generated_at = iso(-21 * 60_000);
    assert.equal(fresh(data.status, now), false);
    assert.equal(getSignal(data, now).kind, "stale");
    assert.equal(getSignal(data, now).evidence, "");
    assert.equal(fresh({ ...data.status, fetchedAt: iso(5 * 60_000) }, now), false);
});

test("an elapsed scheduled time never becomes a confirmed reset", () => {
    const data = snapshot({ scheduled_reset: { scheduled_for: iso(60_000), text: "An announcement", source: { url: "https://x.com/thsottiaux/status/123" } } });
    assert.equal(getSignal(data, now).kind, "announced");
    assert.equal(getSignal(data, now + 60_000).kind, "waiting");
    assert.equal(getSignal(data, now + 60_000).until, null);
});

test("calendar uses announcement dates in Beijing and separates banked resets", () => {
    const data = { fetchedAt: iso(0), payload: { data: [
        { announced_at: "2026-09-27T16:05:00Z", reset_type: "regular", source: { url: "https://x.com/thsottiaux/status/1" } },
        { announced_at: "2026-09-27T16:10:00Z", reset_type: "banked" },
        { announced_at: "2026-09-27T15:55:00Z", reset_type: "banked" },
        { announced_at: "invalid", reset_type: "regular" },
        { announced_at: iso(60_000), reset_type: "regular" },
    ] } };
    const days = calendarDays(data, now);
    assert.equal(days.length, 28);
    assert.deepEqual(days.at(-1), { date: "2026-09-28", type: "both", count: 2, link: "https://x.com/thsottiaux/status/1" });
    assert.equal(days.at(-2).type, "banked");
    assert.equal(calendarDays(undefined, now).at(-1).type, "none");
});

test("invalid data and unsafe links cannot become release cards", () => {
    const release = { tag_name: "v1.0", html_url: "https://github.com/openai/codex/releases", published_at: iso(0), draft: false, prerelease: false };
    assert.equal(normalizePayload("codex", release).tag_name, "v1.0");
    assert.throws(() => normalizePayload("codex", { ...release, prerelease: true }));
    assert.throws(() => normalizePayload("codex", { ...release, html_url: "javascript:alert(1)" }));
    assert.throws(() => normalizePayload("status", { message: "Rate limited" }));
    assert.equal(sourceLink("https://x.com.evil.example/test"), null);
    assert.equal(getSignal({ version: 1 }, now).kind, "unavailable");
});
