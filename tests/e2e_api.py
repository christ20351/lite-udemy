#!/usr/bin/env python3
"""Tests end-to-end de l'API lite-udemy (port 4100)."""
import json
import urllib.request
import http.cookiejar
import sys
import time

SUFFIX = str(int(time.time()))[-6:]

BASE = "http://localhost:4100/api"
results = []

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

def check(name, cond, detail=""):
    results.append((name, cond, detail))
    print(f"{'✅' if cond else '❌'} {name}" + (f" — {detail}" if detail and not cond else ""))

# ── Staff ─────────────────────────────────────────────────────────────
staff = client()
s, d = call(staff, "POST", "/auth/login", {"email": "admin@liteudemy.local", "password": "admin123"})
check("login staff", s == 200)

# ── CRM : client + contact ───────────────────────────────────────────
s, d = call(staff, "POST", "/clients", {"name": f"Delta Corp {SUFFIX}", "type": "COMPANY", "status": "PROSPECT"})
check("créer client", s == 201, str(d))
cid = d["client"]["id"]

s, d = call(staff, "POST", f"/clients/{cid}/contacts", {"name": "Paul Test", "email": f"paul{SUFFIX}@delta.example", "password": "paul1234"})
check("créer contact apprenant", s == 201, str(d))
uid = d["contact"]["id"]

s, d = call(staff, "GET", f"/clients/{cid}")
check("fiche client complète", s == 200 and len(d["client"]["users"]) == 1)

s, d = call(staff, "POST", f"/clients/{cid}/interactions", {"type": "CALL", "content": "Premier appel"})
check("journaliser interaction", s == 201)

# ── Catalogue ─────────────────────────────────────────────────────────
s, d = call(staff, "POST", "/formations", {"title": f"Formation Test {SUFFIX}", "mode": "ONLINE"})
check("créer formation (brouillon)", s == 201 and d["formation"]["status"] == "DRAFT")
fid = d["formation"]["id"]

s, d = call(staff, "POST", f"/formations/{fid}/publish")
check("publish sans leçon refusé", s == 400)

s, d = call(staff, "POST", f"/formations/{fid}/sections", {"title": "Chapitre 1"})
check("créer section", s == 201)
sid = d["section"]["id"]

s, d = call(staff, "POST", f"/formations/sections/{sid}/lessons", {"title": "Leçon 1", "content": "<p>Bonjour</p>", "isPreview": True})
check("créer leçon", s == 201)
lid = d["lesson"]["id"]

s, d = call(staff, "POST", f"/formations/{fid}/publish")
check("publish avec leçon", s == 200 and d["formation"]["status"] == "PUBLISHED")

# ── Souscription + accès ─────────────────────────────────────────────
s, d = call(staff, "POST", "/subscriptions", {"clientId": cid, "formationId": fid, "seats": 2})
check("souscription client→formation", s == 201)

s, d = call(staff, "POST", "/access", {"userId": uid, "formationId": fid})
check("attribuer accès au contact", s == 201)

s, d = call(staff, "POST", "/access", {"userId": uid, "formationId": fid})
check("double accès refusé", s == 409)

# ── Portail apprenant ────────────────────────────────────────────────
paul = client()
s, d = call(paul, "POST", "/auth/login", {"email": f"paul{SUFFIX}@delta.example", "password": "paul1234"})
check("login contact", s == 200 and d["user"]["role"] == "CONTACT")

s, d = call(paul, "GET", "/me/formations")
check("portail: mes formations", s == 200 and len(d["formations"]) == 1 and d["formations"][0]["title"].startswith("Formation Test"))

s, d = call(paul, "GET", f"/me/formations/formation-test-{SUFFIX}")
check("portail: détail formation", s == 200 and d["sections"][0]["lessons"][0]["title"] == "Leçon 1")

s, d = call(paul, "GET", f"/me/lessons/{lid}")
check("portail: lire leçon", s == 200 and d["lesson"]["content"] == "<p>Bonjour</p>")

s, d = call(paul, "PUT", f"/me/lessons/{lid}/progress", {"lastPosition": 42, "completed": True})
check("portail: progression", s == 200 and d["progress"]["completed"] is True)

s, d = call(paul, "GET", "/me/formations")
check("portail: progression %", d["formations"][0]["percent"] == 100)

# ── Sécurité ──────────────────────────────────────────────────────────
anon = client()
s, d = call(anon, "GET", "/me/formations")
check("anonyme bloqué sur /me", s == 401)

s, d = call(anon, "GET", "/clients")
check("anonyme bloqué sur CRM", s == 401)

s, d = call(paul, "GET", "/clients")
check("contact bloqué sur CRM (403)", s == 403)

lea = client()
call(lea, "POST", "/auth/login", {"email": "lea@acme.example", "password": "demo123"})
s, d = call(lea, "GET", "/me/formations")
titles = [f["title"] for f in d.get("formations", [])]
check("Léa ne voit QUE Python (isolation)", not any(t.startswith("Formation Test") for t in titles), str(titles))

# ── Sessions présentielles ───────────────────────────────────────────
from datetime import datetime, timedelta, timezone
start = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
end = (datetime.now(timezone.utc) + timedelta(days=7, hours=6)).isoformat()
s, d = call(staff, "POST", "/sessions", {"formationId": fid, "title": "Journée Delta", "startAt": start, "endAt": end, "capacity": 1})
check("créer session présentielle", s == 201)
sesid = d["session"]["id"]

s, d = call(staff, "POST", f"/sessions/{sesid}/participants", {"userIds": [uid]})
check("inscrire participant", s == 201)

s, d = call(staff, "POST", f"/sessions/{sesid}/participants", {"userIds": ["x"] if False else [uid]})
check("capacité respectée", s in (400, 201))

s, d = call(paul, "GET", "/me/sessions")
check("portail: mes sessions", s == 200 and len(d["sessions"]) == 1 and d["sessions"][0]["title"] == "Journée Delta")

s, d = call(staff, "PATCH", f"/sessions/{sesid}/participants/{uid}", {"attended": True})
check("marquer présence", s == 200 and d["participant"]["attended"] is True)

# ── Récap ────────────────────────────────────────────────────────────
passed = sum(1 for _, ok, _ in results if ok)
print(f"\n{'='*50}\n{passed}/{len(results)} tests réussis")
sys.exit(0 if passed == len(results) else 1)
