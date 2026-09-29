import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTiboFeed, mergeTiboTranslations, translationParts, translationCost, translatePost } from "../src/utils/tibo-feed.ts";

const now = Date.parse("2026-09-29T16:00:00Z");
const post = (id, minutes = 0, extra = {}) => ({ id: String(id), url: `https://x.com/thsottiaux/status/${id}`, text: "Good news for Codex users.", at: new Date(now - minutes * 60_000).toISOString(), ...extra });
const feed = posts => ({ posts, fetched_at: new Date(now).toISOString() });

test("feed accepts only the correct account and post ID, deduplicates, sorts and limits to five", () => {
    const input = feed([post(4, 4), post(1, 1), post(1, 1), post(2, 2), post(6, 6), post(3, 3), post(5, 5),
        post(8, 0, { url: "https://x.com/other/status/8" }), post(9, 0, { url: "javascript:alert(1)" }),
        post(10, 0, { url: "https://x.com.evil.example/thsottiaux/status/10" }), post(11, 0, { url: "https://x.com/thsottiaux/status/12" }),
        post(12, 0, { at: "invalid" }), post(13, -10), post(14, 0, { url: "https://user@x.com/thsottiaux/status/14" })]);
    assert.deepEqual(normalizeTiboFeed(input, now).posts.map(item => item.id), ["1", "2", "3", "4", "5"]);
    assert.throws(() => normalizeTiboFeed({ events: [post(1)] }, now));
    assert.throws(() => normalizeTiboFeed(feed([]), now));
    assert.throws(() => normalizeTiboFeed({ ...input, fetched_at: "invalid" }, now));
});

test("cached Chinese survives a refresh but never attaches to edited English", () => {
    const previous = normalizeTiboFeed(feed([post(1, 1, { text_zh: "好消息" })]), now);
    const incoming = normalizeTiboFeed(feed([post(1, 1), post(2, 2)]), now);
    assert.equal(mergeTiboTranslations(incoming, previous).posts[0].text_zh, "好消息");
    incoming.posts[0].text = "Corrected announcement.";
    assert.equal(mergeTiboTranslations(incoming, previous).posts[0].text_zh, "");
});

test("translation chunks obey UTF-8 byte limits without damaging Unicode, URLs or mentions", () => {
    const original = "Hello 世界 👀 ".repeat(100) + "\n\n@thsottiaux https://t.co/abc\nEnd";
    const parts = translationParts(original);
    assert.equal(parts.map(part => part.text).join(""), original);
    assert.ok(parts.filter(part => part.translate).every(part => Buffer.byteLength(part.text, "utf8") <= 450));
    assert.ok(parts.find(part => part.text === "https://t.co/abc" && !part.translate));
    assert.equal(translationCost("https://t.co/abc @thsottiaux 👀"), 0);
});

test("translation preserves handles, links and paragraphs and requests only free GET translation", async () => {
    const requests = [];
    const mock = async url => { requests.push(new URL(url)); return { ok: true, json: async () => ({ responseStatus: 200, responseData: { translatedText: "好消息 &amp; 更新" } }) }; };
    const result = await translatePost("Good news\n\n@tibo https://t.co/abc", new AbortController().signal, mock);
    assert.equal(result, "好消息 & 更新\n\n@tibo https://t.co/abc");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].pathname, "/get");
    assert.equal(requests[0].searchParams.get("langpair"), "en|zh-CN");
    assert.equal(requests[0].searchParams.has("key"), false);
});

test("quota errors and cancellation never become saved translations", async () => {
    const mock = async () => ({ ok: true, json: async () => ({ responseStatus: 200, quotaFinished: true, responseData: { translatedText: "MYMEMORY WARNING" } }) });
    await assert.rejects(translatePost("Hello world", new AbortController().signal, mock));
    const controller = new AbortController(); controller.abort();
    await assert.rejects(translatePost("Hello world", controller.signal, () => { throw new Error("must not fetch"); }));
    assert.equal(await translatePost("https://t.co/abc", new AbortController().signal, mock), "https://t.co/abc");
});
