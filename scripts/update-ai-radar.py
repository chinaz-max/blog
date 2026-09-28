"""Refresh the public fallback snapshot. Live browsers also fetch the sources directly."""
import argparse
import concurrent.futures
import datetime
import json
from pathlib import Path
import urllib.request

SOURCES = {
    "status": "https://codex-resets.com/api/v1/status",
    "history": "https://codex-resets.com/api/v1/resets?limit=100",
    "codex": "https://api.github.com/repos/openai/codex/releases/latest",
    "claude": "https://api.github.com/repos/anthropics/claude-code/releases/latest",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--proxy", default=None)
    args = parser.parse_args()
    path = Path(__file__).resolve().parents[1] / "public/data/ai-radar.json"
    previous = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"version": 1}
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({"https": args.proxy}) if args.proxy else urllib.request.ProxyHandler())

    def fetch(item):
        key, url = item
        for attempt in range(2):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "ChuzunBlog-AIRadar/1.0"})
                with opener.open(req, timeout=12) as response:
                    data = json.load(response)
                if key in ("codex", "claude"):
                    if not data.get("tag_name") or data.get("draft") or data.get("prerelease"):
                        raise ValueError("Expected a stable release")
                    data = {field: data.get(field) for field in ("name", "tag_name", "html_url", "published_at", "draft", "prerelease")}
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
    snapshot = {"version": 1, **{key: value for key, value in results.items() if value is not None}}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("AI radar snapshot: " + ", ".join(key for key in SOURCES if snapshot.get(key)))


if __name__ == "__main__":
    main()
