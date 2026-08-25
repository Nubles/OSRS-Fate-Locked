#!/usr/bin/env python3
"""Join Quest Helper equip evidence to current OSRSBox item slot/requirement data.

This is an audit helper only. It never changes application data.
"""

from __future__ import annotations

import csv
import json
import re
import urllib.request
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path.cwd()
OUT = ROOT / "audit-output"
HELPERS = OUT / "quest-helper-helpers"
RAW_AUDIT = OUT / "raw-audit.json"
OSRSBOX_SHA = "dae12e3400add0c71465f07a334f9d8f86bebce8"
OSRSBOX_URL = (
    "https://raw.githubusercontent.com/osrsbox/osrsbox-db/"
    f"{OSRSBOX_SHA}/docs/items-complete.json"
)


def normalise(value: str) -> str:
    value = value.lower().replace("&", " and ").replace("'", "")
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def compact(value: str) -> str:
    return normalise(value).replace(" ", "")


def first_string(expression: str) -> str:
    match = re.search(r'"((?:\\.|[^"\\])*)"', expression, re.S)
    if not match:
        match = re.search(r"'((?:\\.|[^'\\])*)'", expression, re.S)
    if not match:
        return ""
    return (
        match.group(1)
        .replace(r'\"', '"')
        .replace(r"\'", "'")
        .replace(r"\n", " ")
    )


def line_number(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def split_arguments(text: str) -> list[str]:
    values: list[str] = []
    start = 0
    paren = bracket = brace = 0
    quote = ""
    escaped = False
    for index, char in enumerate(text):
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = ""
            continue
        if char in {'"', "'"}:
            quote = char
        elif char == "(":
            paren += 1
        elif char == ")":
            paren -= 1
        elif char == "[":
            bracket += 1
        elif char == "]":
            bracket -= 1
        elif char == "{":
            brace += 1
        elif char == "}":
            brace -= 1
        elif char == "," and paren == bracket == brace == 0:
            values.append(text[start:index].strip())
            start = index + 1
    values.append(text[start:].strip())
    return values


def balanced_call(text: str, token_index: int) -> tuple[str, int] | None:
    open_index = text.find("(", token_index)
    if open_index < 0:
        return None
    depth = 0
    quote = ""
    escaped = False
    for index in range(open_index, len(text)):
        char = text[index]
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = ""
            continue
        if char in {'"', "'"}:
            quote = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                return text[open_index + 1:index], index + 1
    return None


DIR_ALIASES = {
    "fairytalei": "Fairytale I - Growing Pains",
    "fairytaleii": "Fairytale II - Cure a Queen",
    "dragonslayer": "Dragon Slayer I",
    "deserttreasure": "Desert Treasure I",
    "deserttreasureii": "Desert Treasure II",
    "ragandboneman": "Rag and Bone Man I",
    "themagearenai": "The Mage Arena I",
    "themagearenaii": "The Mage Arena II",
    "hopespearswill": "Hopespear's Will",
    "thegeneralsshadow": "The General's Shadow",
    "forgettabletale": "Forgettable Tale...",
    "theribbitingtaleofalilypadlabourdispute": "The Ribbiting Tale",
    "blackknightfortress": "Black Knights' Fortress",
    "gardenoftranquility": "Garden of Tranquillity",
    "shieldofarrav": "Shield of Arrav",
    "perilousmoon": "Perilous Moons",
    "thecurseofarrav": "The Curse of Arrav",
    "theredreef": "The Red Reef",
    "thebloodmoonrises": "The Blood Moon Rises",
}

FILE_ALIASES = {
    "RagAndBoneManI.java": "Rag and Bone Man I",
    "RagAndBoneManII.java": "Rag and Bone Man II",
    "RFDCook.java": "RFD: The Cook",
    "AnotherCooksQuest.java": "RFD: The Cook",
    "RFDDwarf.java": "RFD: Dwarf",
    "RFDGoblinGenerals.java": "RFD: Goblins",
    "RFDPiratePete.java": "RFD: Pirate Pete",
    "RFDLumbridgeGuide.java": "RFD: Lumbridge Guide",
    "RFDEvilDave.java": "RFD: Evil Dave",
    "RFDSkrachUglogwee.java": "RFD: Skrach Uglogwee",
    "RFDSirAmikVarze.java": "RFD: Sir Amik Varze",
    "RFDAwowogei.java": "RFD: King Awowogei",
    "RFDFinal.java": "RFD: Finale",
    "ShieldOfArravBlackArmGang.java": "Shield of Arrav",
    "ShieldOfArravPhoenixGang.java": "Shield of Arrav",
    "DragonSlayer.java": "Dragon Slayer I",
    "DesertTreasure.java": "Desert Treasure I",
    "FairytaleI.java": "Fairytale I - Growing Pains",
    "FairytaleII.java": "Fairytale II - Cure a Queen",
    "TheMageArenaI.java": "The Mage Arena I",
    "TheMageArenaII.java": "The Mage Arena II",
}

ITEM_ALIASES = {
    "ivandis/blisterwood flail": ["Ivandis flail", "Blisterwood flail"],
    "ivandis or blisterwood flail": ["Ivandis flail", "Blisterwood flail"],
    "dramen or lunar staff": ["Dramen staff", "Lunar staff"],
    "dramen/lunar staff": ["Dramen staff", "Lunar staff"],
    "ice gloves/smiths gloves(i)": ["Ice gloves", "Smiths gloves (i)"],
    "ice gloves or smiths gloves(i)": ["Ice gloves", "Smiths gloves (i)"],
    "ghostspeak amulet": ["Ghostspeak amulet"],
    "catspeak amulet": ["Catspeak amulet"],
    "catspeak amulet (e)": ["Catspeak amulet (e)"],
    "any greegree": ["Karamjan monkey greegree", "Ninja monkey greegree (small)"],
    "greegree": ["Karamjan monkey greegree"],
    "m'speak amulet": ["M'speak amulet"],
    "bow (not crossbow)": ["Shortbow"],
    "any bow": ["Shortbow"],
    "arrows for bow": ["Bronze arrow"],
    "lit arrow": ["Lit arrow"],
    "ogre arrow": ["Ogre arrow"],
    "ogre bow": ["Ogre bow"],
    "a spiny helmet or slayer helm": ["Spiny helmet", "Slayer helmet"],
    "earmuffs or a slayer helmet": ["Earmuffs", "Slayer helmet"],
    "facemask (or other face covering)": ["Facemask"],
    "antifire shield": ["Anti-dragon shield"],
    "diving apparatus": ["Diving apparatus"],
    "deep sea apparatus": ["Deep sea apparatus"],
    "desert disguise": ["Fake beard", "Kharidian headpiece"],
    "pieces of black clothing": ["Black robe", "Black robe top"],
    "full elite black knight or dark squall outfit": ["Elite black full helm", "Elite black platebody", "Elite black platelegs"],
    "full dark squall outfit": ["Dark squall hood", "Dark squall robe top", "Dark squall robe bottom"],
    "vyre noble outfit": ["Vyre noble top", "Vyre noble legs", "Vyre noble shoes"],
    "butler's uniform": ["Butler's uniform shirt", "Butler's uniform pants"],
    "clockwork suit": ["Clockwork suit"],
    "bedsheet": ["Bedsheet"],
    "desert robe": ["Desert robe"],
    "priest gown (top)": ["Priest gown (top)"],
    "priest gown (bottom)": ["Priest gown (bottom)"],
    "builder's boots": ["Builder's boots"],
    "builder's shirt": ["Builder's shirt"],
    "builder's trousers": ["Builder's trousers"],
    "hard hat": ["Hard hat"],
    "robe of elidinis (top)": ["Robe of elidinis (top)"],
    "beads of the dead": ["Beads of the dead"],
    "10th squad sigil": ["10th squad sigil"],
    "crate with zanik": ["Crate with zanik"],
}


def map_helper_file(file_path: Path, quest_ids: list[str]) -> tuple[str, str, float]:
    if file_path.name in FILE_ALIASES:
        return FILE_ALIASES[file_path.name], "file-alias", 1.0
    parts = file_path.parts
    marker = max(
        parts.index("quests") if "quests" in parts else -1,
        parts.index("miniquests") if "miniquests" in parts else -1,
    )
    slug = parts[marker + 1]
    if slug in DIR_ALIASES:
        return DIR_ALIASES[slug], "dir-alias", 1.0

    by_compact = {compact(quest): quest for quest in quest_ids}
    if compact(slug) in by_compact:
        return by_compact[compact(slug)], "compact", 1.0
    if compact(file_path.stem) in by_compact:
        return by_compact[compact(file_path.stem)], "class-compact", 1.0

    ranked = sorted(
        (
            SequenceMatcher(None, compact(slug), compact(quest)).ratio(),
            quest,
        )
        for quest in quest_ids
    )
    ranked.reverse()
    if ranked[0][0] >= 0.72 and ranked[0][0] - ranked[1][0] >= 0.025:
        return ranked[0][1], "fuzzy", ranked[0][0]
    return "", "unmatched", ranked[0][0]


def scan_helpers(quest_ids: list[str]) -> tuple[list[dict], list[dict]]:
    rows: list[dict] = []
    unmatched: list[dict] = []
    files = list((HELPERS / "quests").rglob("*.java"))
    files.extend((HELPERS / "miniquests").rglob("*.java"))

    assignment_pattern = re.compile(r"(?m)^\s*([A-Za-z_]\w*)\s*=\s*(.+?);\s*$")
    for file_path in files:
        quest, mapping, score = map_helper_file(file_path, quest_ids)
        if not quest:
            unmatched.append({
                "file": str(file_path.relative_to(HELPERS)),
                "score": score,
            })
        source = file_path.read_text(errors="replace")
        definitions: dict[str, dict] = {}

        for match in assignment_pattern.finditer(source):
            variable = match.group(1)
            expression = match.group(2)
            if "ItemRequirement" not in expression and "ItemRequirements" not in expression:
                continue
            name = first_string(expression)
            constants = re.findall(r"(?:ItemID|ItemCollections)\.([A-Z0-9_]+)", expression)
            definitions[variable] = {
                "name": name,
                "constants": constants,
            }
            reasons: list[str] = []
            if ".equipped()" in expression:
                reasons.append("definition-equipped")
            item_call = expression.find("new ItemRequirement")
            if item_call >= 0:
                call = balanced_call(expression, item_call)
                if call:
                    arguments = split_arguments(call[0])
                    if arguments and arguments[-1] == "true":
                        reasons.append("constructor-true")
            if reasons:
                rows.append({
                    "quest": quest,
                    "mapping": mapping,
                    "evidence_type": "+".join(reasons),
                    "helper_file": str(file_path.relative_to(HELPERS)),
                    "line": line_number(source, match.start()),
                    "variable": variable,
                    "item_label": name,
                    "item_constants": constants,
                    "evidence": re.sub(
                        r"\s+", " ",
                        source[max(0, match.start() - 160):min(len(source), match.end() + 260)],
                    ),
                })

        for match in re.finditer(r"\b([A-Za-z_]\w*)\.equipped\(\)", source):
            variable = match.group(1)
            definition = definitions.get(variable, {})
            rows.append({
                "quest": quest,
                "mapping": mapping,
                "evidence_type": "equipped-use",
                "helper_file": str(file_path.relative_to(HELPERS)),
                "line": line_number(source, match.start()),
                "variable": variable,
                "item_label": definition.get("name", ""),
                "item_constants": definition.get("constants", []),
                "evidence": re.sub(
                    r"\s+", " ",
                    source[max(0, match.start() - 220):min(len(source), match.end() + 300)],
                ),
            })

        for match in re.finditer(r"\b([A-Za-z_]\w*)\.setMustBeEquipped\(true\)", source):
            variable = match.group(1)
            definition = definitions.get(variable, {})
            rows.append({
                "quest": quest,
                "mapping": mapping,
                "evidence_type": "setter",
                "helper_file": str(file_path.relative_to(HELPERS)),
                "line": line_number(source, match.start()),
                "variable": variable,
                "item_label": definition.get("name", ""),
                "item_constants": definition.get("constants", []),
                "evidence": re.sub(
                    r"\s+", " ",
                    source[max(0, match.start() - 220):min(len(source), match.end() + 300)],
                ),
            })

    deduped: dict[tuple, dict] = {}
    for row in rows:
        key = (
            row["quest"], row["helper_file"], row["line"],
            row["variable"], row["evidence_type"],
        )
        deduped.setdefault(key, row)
    return list(deduped.values()), unmatched


def load_osrsbox() -> tuple[list[dict], dict[str, list[dict]]]:
    request = urllib.request.Request(
        OSRSBOX_URL,
        headers={"User-Agent": "OSRS-Fate-Locked-full-quest-audit/1.0"},
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        payload = json.load(response)
    items = list(payload.values()) if isinstance(payload, dict) else payload
    by_name: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        name = item.get("name") or item.get("wiki_name")
        if name:
            by_name[normalise(name)].append(item)
    return items, by_name


def candidate_names(label: str) -> list[str]:
    key = normalise(label)
    if key in ITEM_ALIASES:
        return ITEM_ALIASES[key]
    values = [label]
    for separator in ("/", " or "):
        if separator in label.lower():
            values = re.split(r"/|\s+or\s+", label, flags=re.I)
            break
    return [value.strip() for value in values if value.strip()]


def choose_item_matches(label: str, items: list[dict], by_name: dict[str, list[dict]]) -> list[dict]:
    matches: list[dict] = []
    for name in candidate_names(label):
        direct = by_name.get(normalise(name), [])
        equipable = [item for item in direct if item.get("equipable_by_player")]
        selected = equipable or direct
        if selected:
            matches.extend(selected[:4])
            continue
        ranked = sorted(
            (
                SequenceMatcher(None, normalise(name), normalise(item.get("name", ""))).ratio(),
                item,
            )
            for item in items
            if item.get("equipable_by_player") and item.get("name")
        )
        ranked.reverse(key=lambda pair: pair[0])
        matches.extend(item for score, item in ranked[:2] if score >= 0.82)

    unique_matches: dict[int, dict] = {}
    for item in matches:
        unique_matches.setdefault(int(item.get("id", -1)), item)
    return list(unique_matches.values())


def main() -> None:
    audit = json.loads(RAW_AUDIT.read_text())
    quest_ids = [entry["quest"] for entry in audit["quests"]]
    evidence_rows, unmatched_files = scan_helpers(quest_ids)
    items, by_name = load_osrsbox()

    resolved_rows: list[dict] = []
    for row in evidence_rows:
        matches = choose_item_matches(row["item_label"], items, by_name)
        if not matches:
            resolved_rows.append({
                **row,
                "matched_item_id": "",
                "matched_item_name": "",
                "slot": "",
                "two_handed": "",
                "equip_requirements": {},
                "match_state": "unresolved",
            })
            continue
        for item in matches:
            equipment = item.get("equipment") or {}
            resolved_rows.append({
                **row,
                "matched_item_id": item.get("id", ""),
                "matched_item_name": item.get("name", ""),
                "slot": equipment.get("slot", ""),
                "two_handed": bool(equipment.get("2h")),
                "equip_requirements": equipment.get("requirements") or {},
                "match_state": "matched",
            })

    columns = [
        "quest", "mapping", "evidence_type", "helper_file", "line", "variable",
        "item_label", "item_constants", "matched_item_id", "matched_item_name",
        "slot", "two_handed", "equip_requirements", "match_state", "evidence",
    ]
    with (OUT / "equipment-evidence-resolved.csv").open("w", newline="", encoding="utf8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for row in resolved_rows:
            writer.writerow({
                **row,
                "item_constants": "; ".join(row.get("item_constants", [])),
                "equip_requirements": json.dumps(row.get("equip_requirements", {}), sort_keys=True),
            })

    grouped: dict[tuple, dict] = {}
    for row in resolved_rows:
        key = (
            row["quest"], row["variable"], row["item_label"],
            row["matched_item_name"], row["slot"],
            json.dumps(row["equip_requirements"], sort_keys=True),
        )
        if key not in grouped:
            grouped[key] = {
                "quest": row["quest"],
                "variable": row["variable"],
                "item_label": row["item_label"],
                "matched_item_name": row["matched_item_name"],
                "slot": row["slot"],
                "two_handed": row["two_handed"],
                "equip_requirements": row["equip_requirements"],
                "evidence_count": 0,
                "helper_files": set(),
                "evidence_types": set(),
                "sample_evidence": row["evidence"],
            }
        record = grouped[key]
        record["evidence_count"] += 1
        record["helper_files"].add(row["helper_file"])
        record["evidence_types"].add(row["evidence_type"])

    grouped_columns = [
        "quest", "variable", "item_label", "matched_item_name", "slot",
        "two_handed", "equip_requirements", "evidence_count", "helper_files",
        "evidence_types", "sample_evidence",
    ]
    with (OUT / "equipment-evidence-grouped.csv").open("w", newline="", encoding="utf8") as handle:
        writer = csv.DictWriter(handle, fieldnames=grouped_columns)
        writer.writeheader()
        for record in sorted(grouped.values(), key=lambda value: (
            value["quest"], value["variable"], value["matched_item_name"],
        )):
            writer.writerow({
                **record,
                "equip_requirements": json.dumps(record["equip_requirements"], sort_keys=True),
                "helper_files": "; ".join(sorted(record["helper_files"])),
                "evidence_types": "; ".join(sorted(record["evidence_types"])),
            })

    (OUT / "equipment-source-summary.json").write_text(json.dumps({
        "schemaVersion": 1,
        "osrsboxCommit": OSRSBOX_SHA,
        "osrsboxUrl": OSRSBOX_URL,
        "evidenceRows": len(evidence_rows),
        "resolvedRows": sum(row["match_state"] == "matched" for row in resolved_rows),
        "unresolvedRows": sum(row["match_state"] == "unresolved" for row in resolved_rows),
        "questsWithEquipEvidence": len({row["quest"] for row in evidence_rows if row["quest"]}),
        "unmatchedHelperFiles": unmatched_files,
    }, indent=2))

    print(json.dumps(json.loads((OUT / "equipment-source-summary.json").read_text()), indent=2))


if __name__ == "__main__":
    main()
