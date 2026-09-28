/** Use one public key for encoded/decoded slugs, query strings and anchors. */
export function canonicalPage(path: string, site: string): string {
    const base = new URL(site);
    const page = new URL(path, base);
    const parts = page.pathname.replace(/\/index\.html$/, "/").split("/").filter(Boolean);
    const encoded = parts.map(part => {
        try { return encodeURIComponent(decodeURIComponent(part).normalize("NFC")); }
        catch { return encodeURIComponent(part); }
    });
    return `${base.origin}/${encoded.length ? `${encoded.join("/")}/` : ""}`;
}

export function applauseKey(canonical: string): string {
    const url = new URL(canonical);
    return `${url.host}${url.pathname}`;
}

export function parseCounter(value: unknown): number {
    if (typeof value === "string" && /^\d+$/.test(value.trim())) value = Number(value);
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid counter response");
    return value;
}

export function parseViews(value: unknown): { site: number; page: number } {
    if (!value || typeof value !== "object") throw new Error("Invalid views response");
    const data = value as Record<string, unknown>;
    return { site: parseCounter(data.site_pv), page: parseCounter(data.page_pv) };
}

export function likeStorageKey(canonical: string): string {
    return `ctfer:liked:v1:${applauseKey(canonical)}`;
}

export function isLiveSite(location: string, site: string): boolean {
    try { return new URL(location).origin === new URL(site).origin && new URL(site).protocol === "https:"; }
    catch { return false; }
}
