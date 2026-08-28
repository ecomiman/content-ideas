"""Per-platform weighted engagement scoring."""


def _n(engagement, key):
    """Read a numeric engagement value, coercing missing OR null to 0.

    `dict.get(key, 0)` is NOT enough here: it returns the default only when the
    key is ABSENT. Several fetchers emit the key with an explicit `None` when the
    platform does not expose that count — LinkedIn does this routinely for likes
    on posts surfaced via keyword search. That made `likes + 4 * replies` raise
    `TypeError: unsupported operand type(s) for +: 'NoneType' and 'int'` and
    abort the whole run after scraping had already succeeded.
    """
    value = engagement.get(key)
    return value if isinstance(value, (int, float)) else 0


def score_engagement(post):
    """Compute a weighted engagement score based on the post's platform."""
    e = post.get("engagement") or {}
    platform = post.get("platform", "")

    if platform == "x":
        return (_n(e, "likes")
                + 2 * _n(e, "reposts")
                + 3 * _n(e, "replies")
                + 2 * _n(e, "quotes")
                + 4 * _n(e, "bookmarks"))

    if platform == "instagram":
        return (_n(e, "likes")
                + 3 * _n(e, "comments")
                + 0.1 * _n(e, "views"))

    if platform == "tiktok":
        return (_n(e, "likes")
                + 3 * _n(e, "comments")
                + 2 * _n(e, "shares")
                + 2 * _n(e, "saves")
                + 0.05 * _n(e, "views"))

    if platform == "youtube":
        return (_n(e, "views") * 0.1
                + _n(e, "likes")
                + 3 * _n(e, "comments"))

    if platform == "linkedin":
        # Comments are the strongest signal on LinkedIn — substantive discussion,
        # not a passive like. A post people argued with is idea-worthy.
        return (_n(e, "likes")
                + 4 * _n(e, "replies"))  # `replies` carries commentCount

    if platform == "threads":
        return (_n(e, "likes")
                + 3 * _n(e, "replies")
                + 2 * _n(e, "reposts"))  # reposts = spread

    # Fallback: sum all numeric values
    return sum(v for v in e.values() if isinstance(v, (int, float)))
