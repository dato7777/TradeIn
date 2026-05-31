"""Device name normalization for Apple and Samsung trade-in devices."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

# Storage: 128GB, 128 GB, 1TB, bare 128 before end
STORAGE_RE = re.compile(
    r"\b(\d+)\s*(GB|TB)\b|\b(\d{2,4})\b(?=\s*$|\s+(?:Black|White|Starlight|Midnight|Graphite|Natural|Titanium|Blue|Green|Pink|Gold|Silver|Purple|Red|Yellow|Cosmic|Phantom|Sierra|Alpine|Obsidian|Coral|Lavender|Mint|Cream|Gray|Grey|Violet|Ivory|Bronze))",
    re.IGNORECASE,
)

PAREN_RE = re.compile(r"\([^)]*\)")
HEBREW_RE = re.compile(r"[\u0590-\u05FF]+")
CELLULAR_GEN_RE = re.compile(r"\b[35]G\b", flags=re.IGNORECASE)
THIRD_GEN_RE = re.compile(r"\b3rd\s+gen\b", flags=re.IGNORECASE)
RELEASE_YEAR_RE = re.compile(r"\b(?:19[89]\d|20[0-3]\d)\b")
MULTI_SPACE_RE = re.compile(r"\s+")

# Model tokens that must never be stripped as colors/junk
MODEL_KEEP = frozenset({
    "plus", "ultra", "pro", "max", "mini", "fe", "note", "fold", "flip",
    "edge", "prime", "galaxy", "samsung", "iphone", "se", "z",
})

COLOR_WORDS = frozenset({
    "black", "white", "starlight", "midnight", "graphite", "graphith", "natural", "titanium",
    "blue", "green", "pink", "gold", "silver", "purple", "red", "yellow", "cosmic",
    "phantom", "sierra", "alpine", "obsidian", "coral", "lavender", "mint", "cream",
    "gray", "grey", "space", "deep", "light", "dark", "bronze", "violet", "ivory",
    "orange", "lime", "cyan", "teal", "navy", "rose", "sand", "charcoal", "pearl",
    "copper", "amber", "wine", "mystic", "cloud", "ocean", "forest", "sunset",
    "aurora", "ceramic", "titan", "burgundy", "cobalt", "marble", "marbel", "icyblue",
    "icy", "cream", "lemon", "lime", "onyx", "topaz", "emerald", "sapphire", "ruby",
    "jade", "cream", "beige", "blush", "coral", "mint", "lavender",
    "shadow", "jet", "pacific", "ultramarine", "desert", "mist", "soft", "sage",
})

JUNK_WORDS = frozenset({"demo", "sky"})

# Canonical casing for iPhone model tokens (Apple uses lowercase "mini").
IPHONE_MODEL_TOKEN_CANONICAL = {
    "mini": "mini",
    "pro": "Pro",
    "max": "Max",
    "plus": "Plus",
    "se": "SE",
}

SAMSUNG_MODEL_TOKEN_CANONICAL = {
    "plus": "Plus",
    "ultra": "Ultra",
    "edge": "Edge",
    "fe": "FE",
    "pro": "Pro",
    "flip": "Flip",
    "fold": "Fold",
}

# Samsung model core — stops before color/finish suffixes (Edge/Plus/Ultra are model tokens)
FLIP_FOLD_COMPACT_RE = re.compile(r"(?i)\b(?:Z\s*)?(Flip|Fold)(\d+)\b")
FLIP_FOLD_CANONICAL_RE = re.compile(r"(?i)\bZ\s+(Flip|Fold)\s+(\d+)\b")

SAMSUNG_MODEL_CORE_RE = re.compile(
    r"^(?P<core>"
    r"Z\s+(?:Fold|Flip)\s+\d+"
    r"|Note\s?\d+\+?(?:\s+Plus)?"
    r"|Tab\s?[A-Za-z]*\s?\d+"
    r"|[AS]\d+[a-zA-Z]*(?:\s+(?:Ultra|Plus|FE|Edge|Pro|\+))*(?:\s+(?:Ultra|Plus|FE|Edge|Pro|\+))*"
    r"|J\d+"
    r"|M\d+"
    r")",
    re.IGNORECASE,
)

SAMSUNG_BARE_MODEL_RE = re.compile(
    r"^(?:Galaxy\s+)?([ASMJZ]\d+[a-zA-Z]*|Note\s+\d+|Flip\s+\d+|Fold\s+\d+|Galaxy\s+Z\s+\w+)",
    re.IGNORECASE,
)


@dataclass
class NormalizedDevice:
    raw_name: str
    normalized_name: str
    brand: str
    model: str
    storage_gb: str


def _normalize_storage(value: str) -> Optional[str]:
    if not value:
        return None
    v = value.strip().upper().replace(" ", "")
    if v.endswith("TB"):
        return v
    if v.endswith("GB"):
        return v
    if v.isdigit():
        return f"{v}GB"
    return None


def _extract_storage(text: str) -> tuple[Optional[str], str]:
    """Return (storage_gb, text_without_storage_token)."""
    m = STORAGE_RE.search(text)
    if not m:
        return None, text
    if m.group(1) and m.group(2):
        storage = _normalize_storage(f"{m.group(1)}{m.group(2)}")
        span = m.span()
        remaining = text[: span[0]] + text[span[1] :]
        return storage, remaining.strip()
    if m.group(3):
        storage = _normalize_storage(m.group(3))
        span = m.span()
        remaining = text[: span[0]] + text[span[1] :]
        return storage, remaining.strip()
    return None, text


def _strip_junk(text: str) -> str:
    text = HEBREW_RE.sub(" ", text)
    text = CELLULAR_GEN_RE.sub(" ", text)
    text = THIRD_GEN_RE.sub(" ", text)
    text = RELEASE_YEAR_RE.sub(" ", text)
    text = PAREN_RE.sub("", text)
    text = MULTI_SPACE_RE.sub(" ", text).strip()
    return text


def _clean_model_tokens(text: str) -> str:
    """Remove color words, Hebrew, and stray single-letter junk from model text."""
    parts = text.split()
    cleaned: list[str] = []
    for part in parts:
        token = part.strip(".,;:-")
        if not token:
            continue
        lower = token.lower()
        if HEBREW_RE.search(token):
            continue
        if lower in MODEL_KEEP:
            cleaned.append(token)
            continue
        if lower in COLOR_WORDS:
            continue
        if lower in JUNK_WORDS:
            continue
        if len(token) == 1 and token.isalpha():
            continue
        cleaned.append(token)
    return MULTI_SPACE_RE.sub(" ", " ".join(cleaned)).strip()


def _canonicalize_model_tokens(text: str, token_map: dict[str, str]) -> str:
    parts = text.split()
    out: list[str] = []
    for part in parts:
        canonical = token_map.get(part.lower())
        out.append(canonical if canonical is not None else part)
    return MULTI_SPACE_RE.sub(" ", " ".join(out)).strip()


def _canonicalize_iphone_model(model_part: str) -> str:
    parts = model_part.split()
    if not parts:
        return model_part
    head = ["iPhone"] if parts[0].lower() == "iphone" else []
    body = parts[1:] if head else parts
    canonical_body = _canonicalize_model_tokens(" ".join(body), IPHONE_MODEL_TOKEN_CANONICAL)
    return MULTI_SPACE_RE.sub(" ", " ".join(head + ([canonical_body] if canonical_body else []))).strip()


def _canonicalize_samsung_core(core: str) -> str:
    flip_fold = FLIP_FOLD_CANONICAL_RE.match(core)
    if flip_fold:
        return f"Z {flip_fold.group(1).capitalize()} {flip_fold.group(2)}"
    parts = core.split()
    if not parts:
        return core
    if len(parts) >= 3 and parts[0].lower() == "z":
        return _canonicalize_model_tokens(core, SAMSUNG_MODEL_TOKEN_CANONICAL)
    if parts[0].lower() == "note":
        return _canonicalize_model_tokens(core, SAMSUNG_MODEL_TOKEN_CANONICAL)
    head = parts[0]
    tail = _canonicalize_model_tokens(" ".join(parts[1:]), SAMSUNG_MODEL_TOKEN_CANONICAL)
    return f"{head} {tail}".strip() if tail else head


def _normalize_samsung_flip_fold(text: str) -> str:
    """Canonicalize Flip/Fold models to 'Z Flip N' / 'Z Fold N'."""
    text = FLIP_FOLD_COMPACT_RE.sub(
        lambda m: f"Z {m.group(1).capitalize()} {m.group(2)}",
        text,
    )
    text = re.sub(
        r"(?i)\b(?<!Z\s)(Flip|Fold)\s+(\d+)\b",
        lambda m: f"Z {m.group(1).capitalize()} {m.group(2)}",
        text,
    )
    text = FLIP_FOLD_CANONICAL_RE.sub(
        lambda m: f"Z {m.group(1).capitalize()} {m.group(2)}",
        text,
    )
    return text


def _samsung_model_core(model_part: str) -> str:
    """Extract canonical Samsung model id; drop trailing color/finish tokens."""
    model_part = _normalize_samsung_flip_fold(model_part)
    cleaned = _clean_model_tokens(model_part)
    match = SAMSUNG_MODEL_CORE_RE.match(cleaned)
    if match:
        core = match.group("core").strip()
        return _canonicalize_samsung_core(core)
    return cleaned


def normalize_device_name(raw_name: str, manufacturer: Optional[str] = None) -> Optional[NormalizedDevice]:
    """Normalize raw device name to canonical Apple/Samsung format."""
    if not raw_name or not raw_name.strip():
        return None

    raw = raw_name.strip()
    text = _strip_junk(raw)

    storage, text_no_storage = _extract_storage(text)
    if not storage:
        storage, _ = _extract_storage(raw)
        if storage:
            text_no_storage = _strip_junk(PAREN_RE.sub("", raw))
            text_no_storage = STORAGE_RE.sub("", text_no_storage).strip()

    text_no_storage = _strip_junk(text_no_storage)
    text_lower = text_no_storage.lower()

    brand: Optional[str] = None
    if "iphone" in text_lower or (manufacturer and manufacturer.lower() == "apple"):
        brand = "apple"
    elif "samsung" in text_lower or "galaxy" in text_lower or (manufacturer and manufacturer.lower() == "samsung"):
        brand = "samsung"
    elif SAMSUNG_BARE_MODEL_RE.match(text_no_storage):
        brand = "samsung"
    else:
        return None

    if brand == "apple":
        idx = text_lower.find("iphone")
        if idx == -1:
            return None
        model_part = text_no_storage[idx:]
        model_part = re.sub(r"(?i)iphone\s*", "iPhone ", model_part, count=1)
        model_part = _clean_model_tokens(model_part)
        model_part = _canonicalize_iphone_model(model_part)
        model_part = MULTI_SPACE_RE.sub(" ", model_part).strip()
        if not storage:
            return None
        normalized = f"{model_part} {storage}".strip()
        model = model_part.replace("iPhone ", "", 1).strip()
        return NormalizedDevice(raw, normalized, brand, model, storage)

    # Samsung
    text_s = text_no_storage
    if not re.search(r"(?i)samsung|galaxy", text_s):
        text_s = f"Galaxy {text_s}"
    text_s = re.sub(r"(?i)^galaxy\s+", "Galaxy ", text_s.strip())
    if not text_s.lower().startswith("samsung"):
        text_s = f"Samsung {text_s}"
    text_s = re.sub(r"(?i)samsung\s+galaxy\s+", "Samsung Galaxy ", text_s)
    text_s = re.sub(r"(?i)samsung\s+", "Samsung Galaxy ", text_s)
    if "Galaxy Galaxy" in text_s:
        text_s = text_s.replace("Galaxy Galaxy", "Galaxy")

    prefix = "Samsung Galaxy "
    if text_s.startswith(prefix):
        model_part = text_s[len(prefix) :]
    elif text_s.lower().startswith("samsung galaxy "):
        model_part = text_s[15:]
    else:
        model_part = text_s

    model_part = _samsung_model_core(model_part)
    text_s = f"{prefix}{model_part}".strip()
    text_s = MULTI_SPACE_RE.sub(" ", text_s).strip()
    if not storage or not model_part:
        return None
    normalized = f"{text_s} {storage}".strip()
    model = model_part.strip()
    return NormalizedDevice(raw, normalized, brand, model, storage)
