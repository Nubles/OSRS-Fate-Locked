#!/usr/bin/env python3
"""Execute the retained audit resolver with compatibility corrections."""

from pathlib import Path

resolver = Path(__file__).with_name("resolve-quest-equipment.py")
source = resolver.read_text(encoding="utf8")
source = source.replace(
    "        ranked = sorted(\n",
    "        ranked = list(\n",
    1,
)
source = source.replace(
    "ranked.reverse(key=lambda pair: pair[0])",
    "ranked.sort(key=lambda pair: pair[0], reverse=True)",
)
exec(
    compile(source, str(resolver), "exec"),
    {"__name__": "__main__", "__file__": str(resolver)},
)
