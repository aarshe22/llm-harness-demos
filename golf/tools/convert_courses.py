#!/usr/bin/env python3
"""Convert golfMapsR KML course data into game-ready JSON (local yard coords).

Source: https://github.com/abodesy14/golfMapsR (data/kml/*.kml)
License: see repo; credit kept in output metadata.
"""
import xml.etree.ElementTree as ET
import json, math, re, os, sys

NS = '{http://www.opengis.net/kml/2.2}'
KML_DIR = os.path.join(os.path.dirname(__file__), '..', 'kml')
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
YARDS_PER_M = 1.0936133
SIMPLIFY_EPS = 1.6  # yards
COORD_ROUND = 0.5

TYPE_MAP = [
    (('tee', 'tees', 'teebox'), 'tee'),
    (('fairway',), 'fairway'),
    (('green', 'greens', 'putting'), 'green'),
    (('bunker', 'sand', 'trap'), 'bunker'),
    (('water', 'pond', 'lake', 'creek', 'ocean', 'bay', 'hazard_water'), 'water'),
    (('rough', 'waste', 'trees', 'wood', 'out'), 'skip'),
]

COURSES = [
    # file, display name, location, curated pars (None => derive from yardage)
    ('pebble_beach', 'Pebble Beach Golf Links', 'California, USA', [5,4,3,4,4,4,5,4,4,4,4,3,4,4,4,3,4,5]),
    ('augusta_national', 'Augusta National', 'Georgia, USA', [4,5,4,3,5,3,4,4,5,4,4,4,4,5,3,5,4,4]),
    ('erin_hills', 'Erin Hills', 'Wisconsin, USA', None),
    ('kiawah_island_ocean_course', 'Kiawah Island Ocean Course', 'South Carolina, USA', None),
    ('oakland_hills_north', 'Oakland Hills North', 'Michigan, USA', None),
    ('pine_trace', 'Pine Needles Lodge & Golf Club', 'North Carolina, USA', None),
    ('quail_hollow', 'Quail Hollow', 'North Carolina, USA', None),
    ('shinnecock_hills', 'Shinnecock Hills', 'New York, USA', None),
    ('tpc_scottsdale_stadium_course', 'TPC Scottsdale Stadium Course', 'Arizona, USA', None),
    ('tpc_craig_rain', 'TPC Craig Ranch', 'Texas, USA', None),
    ('tpc_craig_ranch', 'TPC Craig Ranch', 'Texas, USA', None),
    ('valhalla', 'Valhalla Golf Club', 'Kentucky, USA', None),
    ('muirfield_village', 'Muirfield Village', 'Ohio, USA', None),
    ('cypress_point', 'Cypress Point Club', 'California, USA', None),
    ('belvedere', 'Belvedere at The Ledges (9)', 'Utah, USA', None),
    ('fieldstone', 'Fieldstone', 'Ohio, USA', None),
    ('crown_golf_club', 'Crown Golf Club', 'Florida, USA', None),
    ('arcadia_bluffs_bluffs_course', 'Arcadia Bluffs Bluffs Course', 'Michigan, USA', None),
    ('katke_cousins', 'Katke Cousins', 'Oregon, USA', None),
    ('raven_golf_club', 'The Raven Golf Club', 'Alabama, USA', None),
]

def rings_of(placemark):
    out = []
    def collect(elem):
        for ring in elem.iter(NS + 'LinearRing'):
            co = ring.find(NS + 'coordinates')
            if co is None or not co.text:
                continue
            pts = []
            for tok in co.text.split():
                parts = tok.split(',')
                if len(parts) < 2:
                    continue
                try:
                    lon, lat = float(parts[0]), float(parts[1])
                except ValueError:
                    continue
                pts.append((lon, lat))
            if len(pts) >= 3:
                out.append(pts)
    for poly in placemark.iter(NS + 'Polygon'):
        outer = poly.find(NS + 'outerBoundaryIs')
        if outer is not None:
            collect(outer)
        else:
            collect(poly)
    return out

def classify(name):
    n = (name or '').lower()
    for keys, t in TYPE_MAP:
        for k in keys:
            if re.search(r'(^|[^a-z])' + k, n):
                return t
    return None

def hole_num(name):
    m = re.search(r'hole[\s_-]*(\d+)', (name or '').lower())
    if m:
        return int(m.group(1))
    m = re.search(r'(?:^|[^a-z])(\d{1,2})(?:$|[^0-9])', (name or ''))
    if m and 1 <= int(m.group(1)) <= 18:
        return int(m.group(1))
    return None

def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    def d(p, a, b):
        ax, az = a; bx, bz = b; px, pz = p
        dx, dz = bx - ax, bz - az
        L2 = dx * dx + dz * dz
        if L2 == 0:
            return math.hypot(px - ax, pz - az)
        t = max(0, min(1, ((px - ax) * dx + (pz - az) * dz) / L2))
        return math.hypot(px - (ax + t * dx), pz - (az + t * dz))
    i, dm = 0, -1
    for j in range(1, len(pts) - 1):
        dd = d(pts[j], pts[0], pts[-1])
        if dd > dm:
            dm, i = dd, j
    if dm > eps:
        left = rdp(pts[:i + 1], eps)
        right = rdp(pts[i:], eps)
        return left[:-1] + right
    return [pts[0], pts[-1]]

def poly_cells(flat, x0, z0, cell, W, H):
    """Rasterize polygon into a bytearray grid: cell centers inside polygon (even-odd)."""
    mask = bytearray(W * H)
    n = len(flat) // 2
    xs = [flat[i * 2] for i in range(n)]
    zs = [flat[i * 2 + 1] for i in range(n)]
    py0, py1 = max(0, int((min(zs) - z0) / cell)), min(H - 1, int((max(zs) - z0) / cell))
    for row in range(py0, py1 + 1):
        y = z0 + (row + 0.5) * cell
        xints = []
        for i in range(n):
            ax, az = xs[i], zs[i]
            bx, bz = xs[(i + 1) % n], zs[(i + 1) % n]
            if (az > y) != (bz > y):
                xints.append(ax + (y - az) / (bz - az) * (bx - ax))
        xints.sort()
        for k in range(0, len(xints) - 1, 2):
            c0 = max(0, int((xints[k] - x0) / cell))
            c1 = min(W - 1, int((xints[k + 1] - x0) / cell))
            for c in range(c0, c1 + 1):
                mask[row * W + c] = 1
    return mask


def corridor_yards(fo, tee_cands, gcen, cell=3.0, pad=40.0):
    """BFS geodesic through tee/fairway/green polygons, farthest reachable tee first.
    Returns (yards, tee_index) or (None, None)."""
    polys = fo['tee'] + fo['fairway'] + fo['green']
    if not polys or not tee_cands:
        return None, None
    xs = [v for p in polys for v in p[0::2]]
    zs = [v for p in polys for v in p[1::2]]
    x0, x1 = min(xs) - pad, max(xs) + pad
    z0, z1 = min(zs) - pad, max(zs) + pad
    W, H = int((x1 - x0) / cell) + 1, int((z1 - z0) / cell) + 1
    if W * H > 400000:
        return None, None
    grid = bytearray(W * H)
    for p in polys:
        m = poly_cells(p, x0, z0, cell, W, H)
        for i in range(W * H):
            grid[i] |= m[i]

    def cell_of(pt):
        c = int((pt[0] - x0) / cell)
        r = int((pt[1] - z0) / cell)
        c = max(0, min(W - 1, c))
        r = max(0, min(H - 1, r))
        return r * W + c

    def nearest_open(idx, maxr=8):
        if grid[idx]:
            return idx
        r0, c0 = divmod(idx, W)
        best, bd = None, 1e9
        for r in range(max(0, r0 - maxr), min(H, r0 + maxr + 1)):
            for c in range(max(0, c0 - maxr), min(W, c0 + maxr + 1)):
                i = r * W + c
                if grid[i]:
                    d = (r - r0) ** 2 + (c - c0) ** 2
                    if d < bd:
                        bd, best = d, i
        return best

    goal = nearest_open(cell_of(gcen))
    if goal is None:
        return None, None
    import heapq
    dist = {goal: 0.0}
    pq = [(0.0, goal)]
    while pq:
        d, i = heapq.heappop(pq)
        if d > dist.get(i, 1e9):
            continue
        r, c = divmod(i, W)
        for dr, dc, w in ((1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1),
                          (1, 1, 1.4142), (1, -1, 1.4142), (-1, 1, 1.4142), (-1, -1, 1.4142)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < H and 0 <= nc < W:
                if dc and dr and not (grid[r * W + nc] and grid[nr * W + c]):
                    continue
                j = nr * W + nc
                if grid[j]:
                    nd = d + w * cell
                    if nd < dist.get(j, 1e9):
                        dist[j] = nd
                        heapq.heappush(pq, (nd, j))
    ordered = sorted(range(len(tee_cands)),
                     key=lambda k: -math.hypot(tee_cands[k][0] - gcen[0], tee_cands[k][1] - gcen[1]))
    for k in ordered:
        i = nearest_open(cell_of(tee_cands[k]))
        if i is not None and i in dist:
            return round(dist[i] + cell), k  # + green approach from center to pin
    k = ordered[0]
    return round(math.hypot(tee_cands[k][0] - gcen[0], tee_cands[k][1] - gcen[1])), k


def main():
    courses_json = {}
    report = []
    for fname, disp, loc, par_ov in COURSES:
        path = os.path.join(KML_DIR, fname + '.kml')
        if not os.path.exists(path):
            continue
        tree = ET.parse(path)
        root = tree.getroot()
        holes = {}
        all_pts = []
        for pm in root.iter(NS + 'Placemark'):
            nm = pm.find(NS + 'name')
            name = nm.text if nm is not None else ''
            t = classify(name)
            if t in (None, 'skip'):
                continue
            h = hole_num(name)
            if h is None or not (1 <= h <= 18):
                continue
            for ring in rings_of(pm):
                holes.setdefault(h, {'tee': [], 'fairway': [], 'green': [], 'bunker': [], 'water': []})
                holes[h][t].append(ring)
                all_pts.extend(ring)
        if not holes:
            continue
        nholes = len(holes)
        if nholes < 9:
            continue
        lat0 = sum(p[1] for p in all_pts) / len(all_pts)
        lon0 = sum(p[0] for p in all_pts) / len(all_pts)
        kx = 111320.0 * math.cos(math.radians(lat0)) * YARDS_PER_M
        kz = 110540.0 * YARDS_PER_M

        def conv(ring):
            out = []
            for lon, lat in ring:
                x = (lon - lon0) * kx
                z = -(lat - lat0) * kz
                out.append((x, z))
            out = rdp(out, SIMPLIFY_EPS)
            # dedupe closes
            while len(out) > 3 and out[0] == out[-1]:
                out.pop()
            flat = []
            for x, z in out:
                flat.append(round(x / COORD_ROUND) * COORD_ROUND)
                flat.append(round(z / COORD_ROUND) * COORD_ROUND)
            return flat

        holes_out = {}
        hole_report = []
        for h in sorted(holes):
            feat = holes[h]
            fo = {k: [conv(r) for r in feat[k]] for k in feat}
            tees = fo['tee']
            greens = fo['green']
            yards = None
            if tees and greens:
                # farthest-back tee = tee centroid farthest from green centroid (flat [x,z,...] yards)
                def cen(flat):
                    n = len(flat) // 2
                    return (sum(flat[i * 2] for i in range(n)) / n, sum(flat[i * 2 + 1] for i in range(n)) / n)
                gcen = cen(max(greens, key=lambda r: len(r)))
                tcands = [cen(r) for r in tees]
                yards, tsel = corridor_yards(fo, tcands, gcen)
            holes_out[h] = {k: v for k, v in fo.items()}
            holes_out[h]['yards_est'] = yards
            holes_out[h]['play_tee'] = tsel if tsel is not None else 0
            hole_report.append((h, yards))
        pars = par_ov
        if pars is None or len(pars) != len(holes_out):
            pars = []
            for h in sorted(holes_out):
                y = holes_out[h]['yards_est'] or 380
                pars.append(3 if y < 220 else (4 if y < 480 else 5))
            # nudge total par toward 72 by flipping borderline holes
            hs = sorted(holes_out)
            guard = 0
            while sum(pars) > 72 and guard < 30:
                guard += 1
                cand = [(holes_out[h]['yards_est'], i) for i, h in enumerate(hs)
                        if pars[i] == 5 and 440 <= (holes_out[h]['yards_est'] or 0) < 500]
                if not cand:
                    cand = [(holes_out[h]['yards_est'], i) for i, h in enumerate(hs) if pars[i] == 5]
                if not cand:
                    break
                pars[min(cand)[1]] = 4
            guard = 0
            while sum(pars) < 71 and guard < 30:
                guard += 1
                cand = [(-(holes_out[h]['yards_est'] or 0), i) for i, h in enumerate(hs)
                        if pars[i] == 4 and 430 <= (holes_out[h]['yards_est'] or 0) < 490]
                if not cand:
                    break
                pars[min(cand)[1]] = 5
        for i, h in enumerate(sorted(holes_out)):
            holes_out[h]['par'] = pars[i] if i < len(pars) else 4
        total = sum(holes_out[h]['yards_est'] or 0 for h in holes_out)
        courses_json[fname] = {
            'id': fname,
            'name': disp,
            'location': loc,
            'origin': [round(lat0, 6), round(lon0, 6)],
            'holes': holes_out,
            'credit': 'Layout data: golfMapsR (github.com/abodesy14/golfMapsR), traced from Google Earth / OpenStreetMap',
        }
        report.append((fname, nholes, total, sum(pars), ''.join(str(min(p,9)) for p in pars)))

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, 'courses.json'), 'w') as f:
        json.dump(courses_json, f, separators=(',', ':'))
    js = 'window.GOLF_COURSES = ' + json.dumps(courses_json, separators=(',', ':')) + ';'
    with open(os.path.join(OUT_DIR, 'courses.js'), 'w') as f:
        f.write(js)
    print('size: %.1f KB' % (len(js) / 1024))
    for r in report:
        print('%-36s holes=%2d total_yds=%5d par=%2d %s' % r)

if __name__ == '__main__':
    main()
