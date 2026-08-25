#!/usr/bin/env python3
"""Execute the retained audit resolver with two compatibility corrections."""

from pathlib import Path

resolver = Path(__file__).with_name("resolve-quest-equipment.py")
source = resolver.read_text(encoding="utf8")
source = source.replace(
    '''        ranked = sorted(
            (
                SequenceMatcher(None, normalise(name), normalise(item.get("name", ""))).ratio(),
                item,
            )
            for item in items
            if item.get("equipable_by_player") and item.get("name")
        )
        ranked.reverse(key=lambda pair: pair[0])
''',
    '''        ranked = sorted(
            (
                SequenceMatcher(None, normalise(name), normalise(item.get("name", ""))).ratio(),
                item,
            )
            for item in items
            if item.get("equipable_by_player") and item.get("name")
        , key=lambda pair: pair[0], reverse=True)
''',
)
exec(
    compile(source, str(resolver), "exec"),
    {"__name__": "__main__", "__file__": str(resolver)},
)
