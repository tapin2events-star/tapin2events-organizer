#!/usr/bin/env python3
"""Keeps the published assets/ folder from growing forever.

Each release adds new hash-named files to assets/. Old ones are kept for a while so people who had TapIN open
before an update aren't disrupted, then removed once they haven't been part of a release for KEEP_DAYS days.
History lives in .github/asset-history.json ({file: last release date}). Run right after copying a new build in.
"""
import json, os, sys, time
KEEP_DAYS = 14
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
assets = os.path.join(root, 'assets')
hist_path = os.path.join(root, '.github', 'asset-history.json')
current = set(sys.argv[1].split(',')) if len(sys.argv) > 1 and sys.argv[1] else set()
try:
    history = json.load(open(hist_path))
except Exception:
    history = {}
now = int(time.time())
for f in current:
    history[f] = now
removed = 0
for f in os.listdir(assets):
    seen = history.get(f)
    # Files with no history predate this cleanup (and the switch to t2- names): treated as last seen long ago.
    if f not in current and (seen is None or now - seen > KEEP_DAYS * 86400):
        os.remove(os.path.join(assets, f)); history.pop(f, None); removed += 1
history = {f: t for f, t in history.items() if os.path.exists(os.path.join(assets, f))}
json.dump(history, open(hist_path, 'w'), indent=0, sort_keys=True)
print(f"assets: kept {len(os.listdir(assets))}, removed {removed}")
