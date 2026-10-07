from pathlib import Path
from PIL import Image
from tools.photos.imaging import load_upright, export_variants, SIZES


def _jpeg_with_orientation(tmp_path: Path, orientation: int) -> Path:
    img = Image.new("RGB", (400, 200), (200, 50, 50))  # wide
    exif = Image.Exif()
    exif[274] = orientation          # Orientation
    exif[0x010F] = "Apple"           # Make — must not survive
    p = tmp_path / f"o{orientation}.jpg"
    img.save(p, exif=exif.tobytes())
    return p


def test_load_upright_applies_orientation(tmp_path):
    img = load_upright(_jpeg_with_orientation(tmp_path, 6))
    assert img.size == (200, 400)
    img3 = load_upright(_jpeg_with_orientation(tmp_path, 3))
    assert img3.size == (400, 200)


def test_load_upright_strips_metadata(tmp_path):
    img = load_upright(_jpeg_with_orientation(tmp_path, 6))
    assert len(img.getexif()) == 0
    assert "exif" not in img.info


def test_export_variants_sizes_and_no_exif(tmp_path):
    src = Image.new("RGB", (3000, 4000), (10, 120, 200))
    paths = export_variants(src, "demo", tmp_path)
    assert len(paths) == len(SIZES) * 2
    for size in SIZES:
        for ext in ("webp", "jpg"):
            p = tmp_path / f"demo-{size}.{ext}"
            assert p.exists()
            with Image.open(p) as out:
                assert max(out.size) == size
                assert len(out.getexif()) == 0
                assert 274 not in out.getexif()
