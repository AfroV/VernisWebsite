"""Load photographer originals upright in sRGB and export metadata-free web variants."""
import io
from pathlib import Path

from PIL import Image, ImageCms, ImageOps

SIZES = (800, 1600, 2400)
_SRGB = ImageCms.createProfile("sRGB")
_SRGB_BYTES = ImageCms.ImageCmsProfile(_SRGB).tobytes()


def load_upright(path: Path) -> Image.Image:
    """Return an upright RGB sRGB copy with no metadata attached."""
    with Image.open(path) as src:
        src.load()
        icc = src.info.get("icc_profile")
        img = ImageOps.exif_transpose(src).convert("RGB")
    if icc:
        img = ImageCms.profileToProfile(
            img, ImageCms.ImageCmsProfile(io.BytesIO(icc)), _SRGB, outputMode="RGB"
        )
    # Rebuild from raw pixels so no EXIF/XMP/GPS survives.
    clean = Image.new("RGB", img.size)
    clean.paste(img)
    return clean


def export_variants(img: Image.Image, scene_id: str, out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for size in SIZES:
        variant = img.copy()
        variant.thumbnail((size, size), Image.LANCZOS)  # never upscales; originals are 5712 px
        webp = out_dir / f"{scene_id}-{size}.webp"
        jpg = out_dir / f"{scene_id}-{size}.jpg"
        variant.save(webp, "WEBP", quality=80, method=6, icc_profile=_SRGB_BYTES)
        variant.save(jpg, "JPEG", quality=82, progressive=True, optimize=True, icc_profile=_SRGB_BYTES)
        written += [webp, jpg]
    return written
