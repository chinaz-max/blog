import assert from "node:assert/strict";
import test from "node:test";
import { applauseKey, canonicalPage, isLiveSite, likeStorageKey, parseCounter, parseViews } from "../src/utils/engagement.ts";

const site = "https://ctfer.cn";

test("an article keeps the same counter across anchors, queries and URL encodings", () => {
    const expected = "https://ctfer.cn/posts/%E6%95%B0%E6%A8%A1/";
    assert.equal(canonicalPage("/posts/数模/#章节", site), expected);
    assert.equal(canonicalPage("/posts/%e6%95%b0%e6%a8%a1/?from=home", site), expected);
    assert.equal(canonicalPage("/posts/数模/index.html", site), expected);
    assert.equal(canonicalPage("/posts/数模", site), expected);
    assert.equal(canonicalPage("/", site), `${site}/`);
});

test("each article has its own server and local repeat-prevention key", () => {
    const first = canonicalPage("/posts/deerflow/", site);
    const second = canonicalPage("/posts/guide/", site);
    assert.notEqual(applauseKey(first), applauseKey(second));
    assert.notEqual(likeStorageKey(first), likeStorageKey(second));
    assert.equal(applauseKey(first), "ctfer.cn/posts/deerflow/");
});

test("only the production HTTPS origin can write real counters", () => {
    assert.equal(isLiveSite("https://ctfer.cn/posts/guide/", site), true);
    for (const url of ["http://127.0.0.1:4321/posts/guide/", "http://localhost:4321/", "https://preview.ctfer.cn/", "https://ctfer.cn.evil.example/", "http://ctfer.cn/", "invalid"]) {
        assert.equal(isLiveSite(url, site), false);
    }
});

test("a missing or erroneous response is never displayed as zero", () => {
    for (const invalid of ["", "   ", "null", null, false, undefined, "<html>Error</html>", "1e3", -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        assert.throws(() => parseCounter(invalid));
    }
    assert.equal(parseCounter("0"), 0);
    assert.equal(parseCounter(" 123 \n"), 123);
    assert.deepEqual(parseViews({ site_pv: "123", page_pv: 12 }), { site: 123, page: 12 });
    assert.throws(() => parseViews({ site_pv: 123 }));
});
