#!/usr/bin/env bash
# Usage: scripts/update-apk.sh /path/to/new/neartap.apk [version]
# Copies the APK into downloads/ and rewrites version, size and SHA-256 in index.html
# from the real file. No build step needed afterwards.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=${1:?path to new apk}; VER=${2:-}
mkdir -p downloads; cp "$SRC" downloads/neartap.apk; cp "$SRC" downloads/halo.apk  # old link kept working
python3 - "$VER" <<'PY'
import hashlib, os, re, sys
ver = sys.argv[1]
p = "downloads/neartap.apk"; b = open(p, "rb").read()
sha = hashlib.sha256(b).hexdigest(); n = len(b)
h = open("index.html").read()
def sub(key, val):
    global h
    h = re.sub(r'(data-rel="%s"[^>]*>)[^<]*' % key, lambda m: m.group(1) + val, h)
sub("sha256", sha); sub("size_bytes", f"{n:,}"); sub("size_mb_label", f"{n/1e6:.2f} MB")
if ver: sub("version", ver)
open("index.html", "w").write(h)
print("sha256", sha, "size", n)
PY
