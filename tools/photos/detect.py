"""Find the dark display quad inside the bright metal frame of a Vernis photo."""
import cv2
import numpy as np
from PIL import Image

WORK = 1200          # long edge used for detection
MIN_AREA = 0.002     # fraction of image
MAX_AREA = 0.25
MIN_CONTRAST = 40    # frame ring must be this much brighter than screen (0-255 gray)


def order_corners(pts: np.ndarray) -> np.ndarray:
    pts = np.asarray(pts, float).reshape(4, 2)
    s = pts.sum(1)
    d = pts[:, 1] - pts[:, 0]
    return np.array([pts[s.argmin()], pts[d.argmin()], pts[s.argmax()], pts[d.argmax()]])


def _mean_in(gray, mask):
    return float(gray[mask > 0].mean()) if mask.any() else 255.0


def _score(gray, quad):
    h, w = gray.shape
    inner = np.zeros_like(gray)
    cv2.fillConvexPoly(inner, quad.astype(np.int32), 255)
    centre = quad.mean(0)
    ring_quad = centre + (quad - centre) * 1.12
    ring = np.zeros_like(gray)
    cv2.fillConvexPoly(ring, ring_quad.astype(np.int32), 255)
    ring[inner > 0] = 0
    screen = _mean_in(gray, inner)
    frame = _mean_in(gray, ring)
    contrast = frame - screen
    x, y, bw, bh = cv2.boundingRect(quad.astype(np.int32))
    squareness = min(bw, bh) / max(bw, bh)
    if contrast < MIN_CONTRAST or squareness < 0.6:
        return None
    return contrast * squareness


def detect_corners(img: Image.Image):
    scale = WORK / max(img.size)
    small = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    gray = cv2.GaussianBlur(cv2.cvtColor(np.asarray(small), cv2.COLOR_RGB2GRAY), (5, 5), 0)
    h, w = gray.shape
    best, best_score = None, 0.0
    for thresh in (40, 60, 80, 100):
        _, mask = cv2.threshold(gray, thresh, 255, cv2.THRESH_BINARY_INV)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        contours, _ = cv2.findContours(mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        for c in contours:
            area = cv2.contourArea(c) / (w * h)
            if not MIN_AREA <= area <= MAX_AREA:
                continue
            approx = cv2.approxPolyDP(c, 0.03 * cv2.arcLength(c, True), True)
            if len(approx) != 4 or not cv2.isContourConvex(approx):
                continue
            quad = order_corners(approx.reshape(4, 2))
            score = _score(gray, quad)
            if score and score > best_score:
                best, best_score = quad, score
    if best is None:
        return None
    return [[round(x / w, 4), round(y / h, 4)] for x, y in best]
