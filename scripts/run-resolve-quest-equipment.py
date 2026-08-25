#!/usr/bin/env python3
"""Execute the audit resolver with a compatibility correction.

The retained resolver used list.reverse(key=...), which Python does not support.
Keeping this one-line correction in a wrapper preserves the captured audit
implementation while allowing the workflow to execute deterministically.
"""

from pathlib import Path

resolver = Path(__file__).with_name("resolve-quest-equipment.py")
source = resolver.read_text(encoding="utf8")
source = source.replace(
    "ranked.reverse(key=lambda pair: pair[0])",
    "ranked.sort(key=lambda pair: pair[0], reverse=True)",
)
exec(compile(source, str(resolver), "exec"), {"__name__": "__main__", "__file__": str(resolver)})
