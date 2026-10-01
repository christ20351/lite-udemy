#!/usr/bin/env python3
"""Test upload + streaming vidéo."""
import json
import subprocess
import urllib.request
import http.cookiejar

BASE = "http://localhost:4100/api"

def client():
    cj = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def call(op, method, path, body=None):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with op.open(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")

staff = client()
call(staff, "POST", "/auth/login", {"email": "admin@liteudemy.local", "password": "admin123"})

# 1. Upload de la vidéo (multipart via curl, plus simple)
out = subprocess.run(
    ["curl", "-s", "-b", "/tmp/admin-cookies.txt", "-X", "POST", f"{BASE}/uploads/video", "-F", "video=@/tmp/test-video.mp4"],
    capture_output=True, text=True,
).stdout
up = json.loads(out)
print("✅ upload:", up["url"], f"({up['size']} octets)")
video_url = up["url"]
filename = video_url.rsplit("/", 1)[1]

# 2. Attacher à la leçon DataFrames de la formation Python
s, d = call(staff, "GET", "/formations")
formation = next(f for f in d["formations"] if f["slug"] == "python-pour-la-data")
s, d = call(staff, "GET", f"/formations/{formation['id']}")
formation = d["formation"]
lesson = next(l for sec in formation["sections"] for l in sec["lessons"] if "DataFrames" in l["title"])
s, d = call(staff, "PATCH", f"/formations/lessons/{lesson['id']}", {"videoPath": video_url, "duration": 360})
assert s == 200, d
print(f"✅ vidéo attachée à la leçon « {d['lesson']['title']} »")

# 3. Streaming
def range_probe(op, name, expected):
    req = urllib.request.Request(f"{BASE}/videos/{filename}", headers={"Range": "bytes=0-1023"})
    try:
        with op.open(req) as r:
            data = r.read()
            code, crange = r.status, r.headers.get("Content-Range")
    except urllib.error.HTTPError as e:
        code, data, crange = e.code, b"", None
    ok = code == expected
    print(f"{'✅' if ok else '❌'} {name}: HTTP {code}" + (f" | Content-Range: {crange}" if crange else ""))
    return ok

anon = client()
jean = client()
call(jean, "POST", "/auth/login", {"email": "jean@acme.example", "password": "demo123"})
lea = client()
call(lea, "POST", "/auth/login", {"email": "lea@acme.example", "password": "demo123"})

results = [
    range_probe(anon, "anonyme → refusé (401 attendu)", 401),
    range_probe(staff, "staff → streaming (206 attendu)", 206),
    range_probe(jean, "jean (accès Python) → 206 attendu", 206),
    range_probe(lea, "lea (accès Python) → 206 attendu", 206),
]
print(f"\n{'✅ TOUS OK' if all(results) else '❌ ÉCHECS'} — upload + streaming + protection")
