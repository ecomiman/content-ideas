"""Date parsing/normalization helpers shared across platform fetchers."""

from datetime import datetime, timedelta, timezone


def days_ago(n):
    """Return the UTC date `n` days before today as a YYYY-MM-DD string."""
    return (datetime.now(timezone.utc) - timedelta(days=n)).strftime("%Y-%m-%d")


def timestamp_to_date(ts):
    """Convert a unix timestamp (int/str) to a UTC YYYY-MM-DD string, or None."""
    if ts in (None, ""):
        return None
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).strftime("%Y-%m-%d")
    except (ValueError, TypeError, OSError):
        return None


def parse_iso_date(s):
    """Parse an ISO-8601 datetime (e.g. '2026-08-25T12:48:46.547Z') to YYYY-MM-DD, or None.

    Used by fetchers whose API returns ISO timestamps (LinkedIn). Falls back to the
    leading YYYY-MM-DD if the full parse fails but the string clearly starts with one.
    """
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00")).strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        s = str(s)
        if len(s) >= 10 and s[4] == "-" and s[7] == "-":
            return s[:10]
        return None


def parse_x_date(created_at):
    """Parse an X/Twitter `created_at` string to YYYY-MM-DD, or None.

    Format example: 'Wed Mar 20 12:34:56 +0000 2026'
    """
    if not created_at:
        return None
    try:
        dt = datetime.strptime(created_at, "%a %b %d %H:%M:%S %z %Y")
        return dt.strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return None
