import unittest
from tibo_feed import normalize_feed, translate_feed, translation_parts


def sample(text="Good news"):
    return {"fetched_at": "2026-09-29T00:00:00Z", "posts": [{"id": "123", "url": "https://x.com/thsottiaux/status/123", "text": text, "at": "2026-09-28T00:00:00Z"}]}


class FeedTests(unittest.TestCase):
    def test_nanosecond_source_time_on_python_310(self):
        raw = sample()
        raw["fetched_at"] = "2026-09-29T00:00:00.286111277Z"
        self.assertEqual(len(normalize_feed(raw)["posts"]), 1)

    def test_only_author_posts_are_accepted(self):
        raw = sample()
        raw["posts"][0]["url"] = "https://x.com/other/status/123"
        with self.assertRaises(ValueError):
            normalize_feed(raw)
        with self.assertRaises(ValueError):
            normalize_feed({"events": []})

    def test_long_unicode_preserves_original_and_api_byte_limit(self):
        text = "Hello 世界 👀 " * 100 + "\n@tibo https://t.co/abc"
        parts = list(translation_parts(text))
        self.assertEqual("".join(part for part, _ in parts), text)
        self.assertTrue(all(len(part.encode("utf-8")) <= 450 for part, translate in parts if translate))

    def test_cache_and_quota_failure(self):
        old = normalize_feed(sample())
        old["posts"][0]["text_zh"] = "好消息"
        def should_not_request(*args):
            self.fail("Cached translation should not make a request")
        translated = translate_feed(normalize_feed(sample()), old, should_not_request)
        self.assertEqual(translated["posts"][0]["text_zh"], "好消息")
        failed = translate_feed(normalize_feed(sample("Changed")), old, lambda *args: {"responseStatus": 403})
        self.assertEqual(failed["posts"][0]["text_zh"], "")
        self.assertEqual(failed["posts"][0]["text"], "Changed")

    def test_only_complete_translations_are_saved(self):
        calls = []
        def request(*args):
            calls.append(args)
            return {"responseStatus": 200 if len(calls) == 1 else 403, "responseData": {"translatedText": "好消息"}}
        translated = translate_feed(normalize_feed(sample("Good news\nSecond paragraph")), None, request)
        self.assertEqual(translated["posts"][0]["text_zh"], "")


if __name__ == "__main__":
    unittest.main()
