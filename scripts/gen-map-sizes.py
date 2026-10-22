#!/usr/bin/env python3
"""Make the world map's smaller copies from the full-size map.

The world map ships in four sizes, all the same picture with the same aspect
ratio, so every overlay (chunk grid, tints, labels, markers) lines up on any of
them. The page picks one with utils/mapImageSize.ts:

  public/osrs_world_map.webp       9216 x 6528  the master (192 px per chunk)
  public/osrs_world_map_4608.webp  4608 x 3264  half size   (96 px per chunk)
  public/osrs_world_map_2304.webp  2304 x 1632  quarter     (48 px per chunk)
  public/osrs_world_map_lo.webp    1280 x  907  instant placeholder

Run it after replacing the master map:

  python3 scripts/gen-map-sizes.py           # rewrite the smaller copies
  python3 scripts/gen-map-sizes.py --check   # only check every size is there

Needs Pillow with WebP support (pip install Pillow). The widths must match
MAP_IMAGE.sizes in utils/mapCoords.ts; utils/mapImageSize.test.ts checks
the files on disk against that list.
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
MASTER = 'osrs_world_map.webp'
# (file, width, WebP quality). The placeholder is small on purpose.
COPIES = [
    ('osrs_world_map_4608.webp', 4608, 82),
    ('osrs_world_map_2304.webp', 2304, 82),
    ('osrs_world_map_lo.webp', 1280, 60),
]


def main() -> int:
    try:
        from PIL import Image
    except ImportError:
        print('Pillow is missing: pip install Pillow', file=sys.stderr)
        return 1
    check = '--check' in sys.argv[1:]
    master = Image.open(os.path.join(ROOT, MASTER))
    mw, mh = master.size
    problems = []
    if not check:
        master = master.convert('RGB')
    for name, width, quality in COPIES:
        height = round(width * mh / mw)
        path = os.path.join(ROOT, name)
        if check:
            if not os.path.exists(path):
                problems.append(f'{name}: missing')
                continue
            with Image.open(path) as im:
                if im.size != (width, height):
                    problems.append(f'{name}: {im.size[0]}x{im.size[1]}, expected {width}x{height}')
            continue
        master.resize((width, height), Image.LANCZOS).save(path, 'WEBP', quality=quality, method=6)
        print(f'{name}: {width}x{height}, {os.path.getsize(path):,} bytes')
    for p in problems:
        print(p, file=sys.stderr)
    if check and not problems:
        print(f'All {len(COPIES)} map sizes match the {mw}x{mh} master.')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
