"""Layout regression: central hub, radial satellites and connected passage graph."""
from collections import deque
from math import hypot
from app.simulation import BUILDINGS, ROOMS, LINKS


def test_central_command_and_radial_campus():
    assert len(BUILDINGS) == 10 and len(ROOMS) == 30
    hub = ROOMS['B01-2']
    assert (hub['x'], hub['z']) == (0.0, 0.0)
    satellite_centers = [ROOMS[f'B{i:02d}-2'] for i in range(2, 11)]
    assert all(10 < hypot(r['x'], r['z']) < 16 for r in satellite_centers)
    assert len({(r['x'], r['z']) for r in satellite_centers}) == 9


def test_passages_match_radial_design_and_remain_connected():
    assert len(LINKS) == 33
    assert sum('B01-2' in link for link in LINKS) >= 6
    adj = {room: set() for room in ROOMS}
    for a, b in LINKS:
        adj[a].add(b)
        adj[b].add(a)
    seen = {'B01-2'}
    todo = deque(['B01-2'])
    while todo:
        for nxt in adj[todo.popleft()]:
            if nxt not in seen:
                seen.add(nxt)
                todo.append(nxt)
    assert len(seen) == 30
