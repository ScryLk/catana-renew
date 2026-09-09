import math
import os
from PIL import Image, ImageDraw

W, H = 1120, 400
im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
draw = ImageDraw.Draw(im)

# Left incoming bezier curve
pts_left = []
for t in [i / 200.0 for i in range(201)]:
    x = (1-t)**3 * 80 + 3*(1-t)**2*t * 280 + 3*(1-t)*t**2 * 420 + t**3 * 560
    y = (1-t)**3 * 150 + 3*(1-t)**2*t * 150 + 3*(1-t)*t**2 * 200 + t**3 * 200
    pts_left.append((x, y))

for i in range(len(pts_left) - 1):
    alpha = int(30 + 170 * (i / len(pts_left)))
    draw.line([pts_left[i], pts_left[i+1]], fill=(197, 191, 183, alpha), width=3)

# Right incoming bezier curve
pts_right = []
for t in [i / 200.0 for i in range(201)]:
    x = (1-t)**3 * 1040 + 3*(1-t)**2*t * 840 + 3*(1-t)*t**2 * 700 + t**3 * 560
    y = (1-t)**3 * 250 + 3*(1-t)**2*t * 250 + 3*(1-t)*t**2 * 200 + t**3 * 200
    pts_right.append((x, y))

for i in range(len(pts_right) - 1):
    alpha = int(30 + 170 * (i / len(pts_right)))
    draw.line([pts_right[i], pts_right[i+1]], fill=(197, 191, 183, alpha), width=3)

# Subtle orbit ellipse around center
cx, cy, rx, ry = 560, 200, 136, 56
steps = 180
ellipse_pts = [(cx + rx * math.cos(math.radians(a)), cy + ry * math.sin(math.radians(a))) for a in range(steps)]
for i in range(0, len(ellipse_pts), 2):
    p1 = ellipse_pts[i]
    p2 = ellipse_pts[(i+1) % len(ellipse_pts)]
    draw.line([p1, p2], fill=(185, 179, 171, 90), width=2)

# Central convergence node in deep L'Oréal burgundy
r = 6
draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(126, 27, 40, 230))

final_im = im.resize((560, 200), Image.Resampling.LANCZOS)
base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
media_path = os.path.join(base, 'media', 'media', 'skinsync_symbol.png')
final_im.save(media_path)
print(f'PNG saved to {media_path}')
