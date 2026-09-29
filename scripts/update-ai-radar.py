"""Refresh the public fallback snapshot. Live browsers also fetch the sources directly."""
import argparse
import concurrent.futures
import datetime
import json
from pathlib import Path
import urllib.request
from tibo_feed import FEED_URL, normalize_feed, translate_feed

SOURCES = {
    "status": "https://codex-resets.com/api/v1/status",
    "history": "https://codex-resets.com/api/v1/resets?limit=100",
    "tibo": FEED_URL,
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--proxy", default=None)
    args = parser.parse_args()
    path = Path(__file__).resolve().parents[1] / "public/data/ai-radar.json"
    previous = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"version": 1}
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({"https": args.proxy}) if args.proxy else urllib.request.ProxyHandler())

    def fetch_json(url, timeout=12):
        req = urllib.request.Request(url, headers={"User-Agent": "ChuzunBlog-AIRadar/2.0"})
        with opener.open(req, timeout=timeout) as response:
            return json.load(response)

    def fetch(item):
        key, url = item
        for attempt in range(2):
            try:
                data = fetch_json(url)
                if key == "tibo":
                    data = normalize_feed(data)
                elif not isinstance(data.get("data"), list if key == "history" else dict):
                    raise ValueError("Invalid source payload")
                if key == "history":
                    data["data"] = [{field: entry.get(field) for field in ("id", "reset_type", "announced_at", "source")} for entry in data["data"][:100]]
                return key, {"fetchedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "payload": data}
            except Exception as error:
                if attempt == 1:
                    print(f"{key}: source unavailable ({type(error).__name__} {getattr(error, 'code', '')}); retaining its original snapshot timestamp")
        return key, previous.get(key)

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results = dict(pool.map(fetch, SOURCES.items()))
    if results.get("tibo"):
        results["tibo"]["payload"] = translate_feed(results["tibo"]["payload"], previous.get("tibo", {}).get("payload"), fetch_json)
    snapshot = {"version": 1, **{key: value for key, value in results.items() if value is not None}}
    path.parent.mkdir(parents=True, exist_ok=True)
    pending = path.with_suffix(".tmp")
    pending.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    pending.replace(path)
    print("AI radar snapshot: " + ", ".join(key for key in SOURCES if snapshot.get(key)))


if __name__ == "__main__":
    main()
