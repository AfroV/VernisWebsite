from tools.photos.scenes import load_scenes, merge_scene, save_scenes

E = {"id": "a", "src": "images/scenes/a", "w": 10, "h": 20, "corners": [[0, 0], [1, 0], [1, 1], [0, 1]],
     "originalArt": False, "tags": [], "alt": "x"}


def test_load_missing_file_gives_empty(tmp_path):
    assert load_scenes(tmp_path / "none.json") == {"version": 1, "scenes": []}


def test_merge_adds_new():
    data = merge_scene({"version": 1, "scenes": []}, E)
    assert data["scenes"][0]["id"] == "a"


def test_merge_keeps_existing_corners():
    tuned = [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]]
    data = {"version": 1, "scenes": [dict(E, corners=tuned)]}
    data = merge_scene(data, dict(E, corners=[[0, 0], [1, 0], [1, 1], [0, 1]], alt="new alt"))
    assert data["scenes"][0]["corners"] == tuned
    assert data["scenes"][0]["alt"] == "new alt"


def test_merge_force_overwrites_corners():
    data = {"version": 1, "scenes": [dict(E, corners=[[0.1, 0.1]] * 4)]}
    data = merge_scene(data, E, force=True)
    assert data["scenes"][0]["corners"] == E["corners"]


def test_merge_fills_null_corners():
    data = {"version": 1, "scenes": [dict(E, corners=None)]}
    assert merge_scene(data, E)["scenes"][0]["corners"] == E["corners"]


def test_roundtrip(tmp_path):
    p = tmp_path / "s.json"
    save_scenes(p, merge_scene({"version": 1, "scenes": []}, E))
    assert load_scenes(p)["scenes"][0]["id"] == "a"
