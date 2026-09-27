"""Read, merge and write data/screens.json. Hand-tuned corners always win."""
import json
from pathlib import Path


def load_scenes(path: Path) -> dict:
    path = Path(path)
    if not path.exists():
        return {"version": 1, "scenes": []}
    return json.loads(path.read_text())


def merge_scene(data: dict, entry: dict, force: bool = False) -> dict:
    for i, existing in enumerate(data["scenes"]):
        if existing["id"] == entry["id"]:
            merged = {**existing, **entry}
            if existing.get("corners") and not force:
                merged["corners"] = existing["corners"]
            data["scenes"][i] = merged
            return data
    data["scenes"].append(entry)
    return data


def save_scenes(path: Path, data: dict) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data, indent=2) + "\n")
