"""Free public Tibo feed and bounded, cached MyMemory translations for build snapshots."""
import datetime
import html
import re
import time
import urllib.parse

FEED_URL = "https://willreset.com/api/feed"
TRANSLATE_URL = "https://api.mymemory.translated.net/get"


def parse_time(value):
    # Python 3.10 accepts microseconds, while the feed supplies nanoseconds.
    value = re.sub(r"(\.\d{6})\d+", r"\1", value)
    return datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))


def normalize_feed(data):
    if not isinstance(data, dict) or not isinstance(data.get("posts"), list):
        raise ValueError("Invalid Tibo feed")
    now = datetime.datetime.now(datetime.timezone.utc)
    generated = parse_time(data["fetched_at"])
    if generated > now + datetime.timedelta(minutes=1):
        raise ValueError("Future feed timestamp")
    posts = {}
    for item in data["posts"][:200]:
        try:
            post_id = item["id"]
            if not isinstance(post_id, str) or not re.fullmatch(r"\d{1,30}", post_id):
                continue
            url = urllib.parse.urlsplit(item["url"])
            if url.scheme != "https" or url.netloc not in ("x.com", "twitter.com") or url.path != f"/thsottiaux/status/{post_id}":
                continue
            text = item["text"]
            if not isinstance(text, str) or not text.strip() or len(text) > 30000:
                continue
            posted = parse_time(item["at"])
            if posted > now + datetime.timedelta(minutes=1):
                continue
            posts.setdefault(post_id, {"id": post_id, "url": f"https://x.com/thsottiaux/status/{post_id}", "text": text,
                                       "at": posted.isoformat(), "is_reply": item.get("is_reply") is True, "text_zh": ""})
        except (KeyError, ValueError, TypeError, AttributeError):
            continue
    if not posts:
        raise ValueError("No valid Tibo posts")
    return {"fetched_at": data["fetched_at"], "posts": sorted(posts.values(), key=lambda post: post["at"], reverse=True)[:5]}


def translation_parts(text):
    for piece in re.split(r"(https?://[^\s]+|@[A-Za-z0-9_]+|\n+)", text):
        if not piece:
            continue
        if re.match(r"https?://|@|\n", piece) or not re.search(r"[A-Za-z]{2}", piece):
            yield piece, False
            continue
        while piece:
            chunk = piece.encode("utf-8")[:450].decode("utf-8", errors="ignore")
            if len(chunk) < len(piece) and chunk.rfind(" ") > len(chunk) / 2:
                chunk = chunk[:chunk.rfind(" ") + 1]
            yield chunk, bool(chunk.strip())
            piece = piece[len(chunk):]


def translate_feed(feed, previous, fetch_json, budget=4500, seconds=35):
    """Only cache complete translations; never replace the English source text."""
    old_posts = previous.get("posts", []) if isinstance(previous, dict) else []
    deadline = time.monotonic() + seconds
    for post in feed["posts"]:
        cached = next((old.get("text_zh", "") for old in old_posts
                       if old.get("id") == post["id"] and old.get("text") == post["text"]), "")
        if cached:
            post["text_zh"] = cached
            continue
        parts = list(translation_parts(post["text"]))
        cost = sum(len(part.strip()) for part, translate in parts if translate)
        if cost > budget or time.monotonic() >= deadline:
            continue
        budget -= cost
        result = []
        try:
            for part, translate in parts:
                if not translate:
                    result.append(part)
                    continue
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError("Translation time budget exhausted")
                url = TRANSLATE_URL + "?" + urllib.parse.urlencode({"q": part.strip(), "langpair": "en|zh-CN", "mt": "1"})
                response = fetch_json(url, min(10, remaining))
                translated = response.get("responseData", {}).get("translatedText")
                if str(response.get("responseStatus")) != "200" or response.get("quotaFinished") is True or not isinstance(translated, str) or not translated.strip() or len(translated) > 6000:
                    raise ValueError("Free translation unavailable")
                result.append(re.match(r"\s*", part).group() + html.unescape(translated) + re.search(r"\s*$", part).group())
            post["text_zh"] = "".join(result)
        except Exception as error:
            print(f"tibo: translation unavailable ({type(error).__name__}); preserving English")
            break
    return feed
