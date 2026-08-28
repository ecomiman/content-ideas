"""LinkedIn fetcher — KEYWORD search, not per-author.

`/v1/linkedin/search/posts` finds recent public posts matching a keyword (via
Google's index of LinkedIn). There is no per-author endpoint, so a LinkedIn
'tracked account' is really a topic lane: the `handle` the pipeline passes is
used as the search query. This is how the niche's LinkedIn-primary voices
(who never surface via handle tracking) reach the feed.
"""

from . import dates
from .http import sc_get

# The daily feed wants recent posts; the pipeline's own recency filter narrows
# further to since-last-run, so a weekly window here keeps a missed run from
# dropping 2-day-old posts.
DATE_WINDOW = "last-week"


def _author_name(author):
    if isinstance(author, dict):
        return author.get("name") or author.get("title") or author.get("handle") or ""
    return str(author) if author else ""


def fetch_profile(query, api_key):
    """GET /v1/linkedin/search/posts — recent public posts matching `query`.

    Called by the pipeline as fetch_profile(handle, api_key); here `handle` is a
    search query string, and each result is a post from whoever wrote it.
    """
    data = sc_get(
        "/v1/linkedin/search/posts",
        {"query": query, "date_posted": DATE_WINDOW},
        api_key,
    )
    if not data:
        return []
    posts = []
    for item in (data.get("posts") or []):
        posts.append({
            "text": item.get("description", ""),
            "url": item.get("url", ""),
            "author": _author_name(item.get("author")) or query,
            "date": dates.parse_iso_date(item.get("datePublished")),
            "platform": "linkedin",
            "engagement": {
                "likes": item.get("likeCount", 0),
                "replies": item.get("commentCount", 0),
            },
        })
    return posts
