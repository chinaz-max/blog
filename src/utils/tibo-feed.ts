export const TIBO_FEED_URL = "https://willreset.com/api/feed";
export const TRANSLATE_URL = "https://api.mymemory.translated.net/get";
export type TiboPost = { id: string; url: string; text: string; at: string; is_reply: boolean; text_zh: string };
export type TiboFeed = { posts: TiboPost[]; fetched_at: string };

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function normalizeTiboFeed(value: unknown, now = Date.now()): TiboFeed {
    const data = object(value);
    if (!Array.isArray(data.posts) || typeof data.fetched_at !== "string" || !Number.isFinite(Date.parse(data.fetched_at)) || Date.parse(data.fetched_at) > now + 60_000) throw new Error("Invalid Tibo feed");
    const posts = new Map<string, TiboPost>();
    for (const raw of data.posts.slice(0, 200)) {
        const item = object(raw);
        if (typeof item.id !== "string" || !/^\d{1,30}$/.test(item.id) || typeof item.url !== "string" || typeof item.text !== "string" || !item.text.trim() || item.text.length > 30_000 || typeof item.at !== "string") continue;
        try {
            const url = new URL(item.url);
            if (url.protocol !== "https:" || !["x.com", "twitter.com"].includes(url.hostname) || url.port || url.username || url.password || url.pathname !== `/thsottiaux/status/${item.id}`) continue;
            if (!Number.isFinite(Date.parse(item.at)) || Date.parse(item.at) > now + 60_000) continue;
            if (!posts.has(item.id)) posts.set(item.id, {
                id: item.id, url: `https://x.com/thsottiaux/status/${item.id}`, text: item.text, at: item.at,
                is_reply: item.is_reply === true,
                text_zh: typeof item.text_zh === "string" ? item.text_zh.slice(0, 30_000) : "",
            });
        } catch { /* Discard malformed or unrelated links. */ }
    }
    if (!posts.size) throw new Error("No valid Tibo posts");
    return { posts: [...posts.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 5), fetched_at: data.fetched_at };
}

export function mergeTiboTranslations(incoming: TiboFeed, previous?: TiboFeed): TiboFeed {
    return { ...incoming, posts: incoming.posts.map(post => {
        const cached = previous?.posts.find(old => old.id === post.id && old.text === post.text);
        return { ...post, text_zh: post.text_zh || cached?.text_zh || "" };
    }) };
}

// Preserve URLs, handles and paragraph breaks without sending them for translation.
export function translationParts(value: string): { text: string; translate: boolean }[] {
    const parts: { text: string; translate: boolean }[] = [];
    const encoder = new TextEncoder();
    for (const piece of value.split(/(https?:\/\/[^\s]+|@[A-Za-z0-9_]+|\n+)/g).filter(Boolean)) {
        if (/^(https?:\/\/|@|\n)/.test(piece) || !/[A-Za-z]{2}/.test(piece)) {
            parts.push({ text: piece, translate: false });
            continue;
        }
        let rest = piece;
        while (rest) {
            let chunk = "";
            let bytes = 0;
            for (const char of rest) {
                const size = encoder.encode(char).length;
                if (bytes + size > 450) break;
                chunk += char;
                bytes += size;
            }
            if (chunk.length < rest.length) {
                const space = chunk.lastIndexOf(" ");
                if (space > chunk.length / 2) chunk = chunk.slice(0, space + 1);
            }
            parts.push({ text: chunk, translate: Boolean(chunk.trim()) });
            rest = rest.slice(chunk.length);
        }
    }
    return parts;
}

export function translationCost(value: string) {
    return translationParts(value).filter(part => part.translate).reduce((sum, part) => sum + Array.from(part.text.trim()).length, 0);
}

export async function translatePost(value: string, signal: AbortSignal, request: typeof fetch = fetch): Promise<string> {
    const result: string[] = [];
    for (const part of translationParts(value)) {
        signal.throwIfAborted();
        if (!part.translate) { result.push(part.text); continue; }
        const url = new URL(TRANSLATE_URL);
        url.search = new URLSearchParams({ q: part.text.trim(), langpair: "en|zh-CN", mt: "1" }).toString();
        const response = await request(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]), credentials: "omit" });
        if (!response.ok) throw new Error("Translation unavailable");
        const payload = object(await response.json());
        const translated = object(payload.responseData).translatedText;
        if (Number(payload.responseStatus) !== 200 || payload.quotaFinished === true || typeof translated !== "string" || !translated.trim() || translated.length > 6000) throw new Error("Translation unavailable");
        // Decode common API entities as text; never interpret returned HTML.
        const decoded = translated.replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, entity: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" })[entity] || "");
        result.push((part.text.match(/^\s*/)?.[0] || "") + decoded + (part.text.match(/\s*$/)?.[0] || ""));
    }
    return result.join("");
}
