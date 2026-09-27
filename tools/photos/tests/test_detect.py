import numpy as np
from PIL import Image, ImageDraw
from tools.photos.detect import detect_corners, order_corners

SCREEN = [(470, 300), (760, 315), (750, 600), (480, 585)]


def _scene(screen_fill=(12, 12, 16), with_screen=True):
    img = Image.new("RGB", (1200, 1600), (140, 138, 132))      # concrete-ish
    d = ImageDraw.Draw(img)
    d.rectangle([0, 900, 1200, 1600], fill=(170, 120, 70))     # wooden shelf
    d.polygon([(430, 260), (800, 275), (790, 640), (440, 625)], fill=(205, 180, 120))  # brass frame
    if with_screen:
        d.polygon(SCREEN, fill=screen_fill)
    return img


def test_order_corners():
    pts = np.array([[10, 10], [0, 10], [10, 0], [0, 0]], float)
    assert order_corners(pts).tolist() == [[0, 0], [10, 0], [10, 10], [0, 10]]


def test_detects_dark_screen_inside_frame():
    corners = detect_corners(_scene())
    assert corners is not None
    for (cx, cy), (ex, ey) in zip(corners, SCREEN):
        assert abs(cx - ex / 1200) < 0.01 and abs(cy - ey / 1600) < 0.01


def test_bright_screen_returns_none_not_the_outer_frame():
    # Screen showing bright art: must not report the brass frame's outer edge.
    corners = detect_corners(_scene(screen_fill=(210, 190, 140)))
    assert corners is None


def test_no_screen_returns_none():
    assert detect_corners(_scene(with_screen=False)) is None
