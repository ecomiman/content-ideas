"""Threads fetcher. Text-only: no comment or transcript endpoints.

Unlike X (whose ScrapeCreators endpoint returns 100 most-*popular* tweets, useless
for a recency feed), `/v1/threads/user/posts` returns a user's *recent* posts — so
Threads is a live source for creators who cross-post there.
"""

from . import dates
from .http import sc_get


def fetch_profile(handle, api_key):
    """GET /v1/threads/user/posts — the user's last ~20-30 recent posts."""
    data = sc_get("/v1/threads/user/posts", {"handle": handle, "trim": "true"}, api_key)
    if not data:
        return []
    posts = []
    for item in (data.get("posts") or []):
        caption = item.get("caption") or {}
        text = caption.get("text", "") if isinstance(caption, dict) else str(caption)
        posts.append({
            "text": text,
            "url": item.get("url", ""),
            "author": handle,
            "date": dates.timestamp_to_date(item.get("taken_at")),
            "platform": "threads",
            "engagement": {
                "likes": item.get("like_count", 0),
                "replies": item.get("reply_count", 0) or item.get("direct_reply_count", 0) or 0,
                "reposts": item.get("repost_count", 0) or item.get("reshare_count", 0) or 0,
            },
        })
    return posts
