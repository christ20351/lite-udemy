#!/usr/bin/env python3
"""Tests end-to-end de l'API lite-udemy (port 4100) — flux B2C multi-rôles."""
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

# ── Connexions (comptes du seed) ──────────────────────────────────────
admin = client()
s, d = call(admin, "POST", "/auth/login", {"email": "admin@liteudemy.local", "password": "admin123"})
check("login admin", s == 200 and d["user"]["role"] == "ADMIN", str(d))

gest = client()
s, d = call(gest, "POST", "/auth/login", {"email": "gestion@liteudemy.local", "password": "gestion123"})
check("login gestionnaire", s == 200 and d["user"]["role"] == "GESTIONNAIRE")

seed_trainer = client()
s, d = call(seed_trainer, "POST", "/auth/login", {"email": "formateur@liteudemy.local", "password": "formateur123"})
check("login formateur (seed)", s == 200 and d["user"]["role"] == "FORMATEUR")

# ── Équipe (réservée à l'admin) ───────────────────────────────────────
s, d = call(gest, "GET", "/team")
check("équipe interdite au gestionnaire", s == 403)

s, d = call(admin, "POST", "/team", {
    "name": "Nina Formatrice", "email": f"nina{SUFFIX}@team.example",
    "password": "nina1234", "role": "FORMATEUR",
})
check("admin crée un formateur", s == 201 and d["member"]["role"] == "FORMATEUR", str(d))
trainer_uid = d["member"]["id"]

trainer = client()
s, d = call(trainer, "POST", "/auth/login", {"email": f"nina{SUFFIX}@team.example", "password": "nina1234"})
check("login nouveau formateur", s == 200)

# ── Formations : la gestion crée, le formateur construit ─────────────
s, d = call(trainer, "POST", "/formations", {"title": f"Formation {SUFFIX}"})
check("formateur ne peut PAS créer une formation", s == 403)

s, d = call(gest, "POST", "/formations", {"title": f"Formation Test {SUFFIX}", "mode": "ONLINE", "price": 99})
check("gestionnaire crée la formation (payante)", s == 201 and d["formation"]["status"] == "DRAFT")
fid = d["formation"]["id"]

s, d = call(gest, "POST", f"/formations/{fid}/instructors", {"userId": trainer_uid})
check("gestionnaire assigne le formateur", s == 200, str(d))

s, d = call(trainer, "GET", "/me/notifications")
ok = s == 200 and d["unread"] >= 1 and any("Formation Test" in n["title"] for n in d["notifications"])
check("formateur notifié de l'assignation", ok, str(d))
notif_id = next(n["id"] for n in d["notifications"] if "Formation Test" in n["title"])
s, d = call(trainer, "PATCH", f"/me/notifications/{notif_id}/read")
check("marquer la notification comme lue", s == 200 and d["notification"]["read"] is True)

s, d = call(trainer, "GET", f"/formations/{fid}")
check("formateur voit sa formation", s == 200)

s, d = call(trainer, "GET", "/formations")
titles = [f["title"] for f in d["formations"]]
check("formateur ne voit QUE ses formations", all(t.startswith("Formation Test") for t in titles), str(titles))

s, d = call(trainer, "PATCH", f"/formations/{fid}", {"price": 1})
check("formateur ne peut pas modifier les métadonnées", s == 403)

s, d = call(trainer, "POST", f"/formations/{fid}/publish")
check("formateur ne peut pas publier", s == 403)

s, d = call(trainer, "POST", f"/formations/{fid}/sections", {"title": "Chapitre 1"})
check("formateur crée une section", s == 201)
sid = d["section"]["id"]

s, d = call(trainer, "POST", f"/formations/sections/{sid}/lessons", {"title": "Leçon 1", "content": "<p>Bonjour</p>", "isPreview": True})
check("formateur crée une leçon", s == 201)
lid = d["lesson"]["id"]

s, d = call(trainer, "PUT", f"/staff/quiz/lessons/{lid}/quiz", {
    "questions": [
        {"text": "2+2 ?", "choices": [{"text": "4", "correct": True}, {"text": "5", "correct": False}]},
    ],
})
check("formateur crée le quiz de sa leçon", s == 200, str(d))

s, d = call(gest, "POST", f"/formations/{fid}/publish")
check("gestionnaire publie (avec leçon)", s == 200 and d["formation"]["status"] == "PUBLISHED")

# ── Apprenants : auto-inscription gratuite, gestion pour payant ──────
learner = client()
s, d = call(learner, "POST", "/auth/signup", {"name": "Paula Test", "email": f"paula{SUFFIX}@example.fr", "password": "paula123"})
check("signup apprenant", s == 201 and d["user"]["role"] == "APPRENANT", str(d))
learner_uid = d["user"]["id"]

s, d = call(learner, "POST", "/me/enroll", {"formationId": fid})
check("auto-inscription refusée sur formation payante", s == 400, str(d))

s, d = call(trainer, "POST", "/enrollments", {"userId": learner_uid, "formationId": fid})
check("formateur inscrit l'apprenant (sa formation)", s == 201, str(d))

s, d = call(trainer, "POST", "/enrollments", {"userId": learner_uid, "formationId": fid})
check("double inscription refusée", s == 409)

# Apprenant libre (auto-inscrit) : création d'une formation gratuite par la gestion
s, d = call(gest, "POST", "/formations", {"title": f"Gratuite {SUFFIX}", "instructorId": trainer_uid})
check("création liée directement au formateur", s == 201, str(d))
free_fid = d["formation"]["id"]

s, d = call(trainer, "GET", "/formations")
titles = [f["title"] for f in d["formations"]]
check("formateur voit la formation liée à la création", any(t.startswith("Gratuite") for t in titles), str(titles))

s, d = call(trainer, "GET", "/me/notifications")
ok = s == 200 and any("Gratuite" in n["title"] for n in d["notifications"])
check("notification reçue dès la création", ok, str(d))
s, d = call(gest, "POST", f"/formations/{free_fid}/sections", {"title": "Intro"})
free_sid = d["section"]["id"]
call(gest, "POST", f"/formations/sections/{free_sid}/lessons", {"title": "Bienvenue", "isPreview": True})
call(gest, "POST", f"/formations/{free_fid}/publish")

learner2 = client()
s, d = call(learner2, "POST", "/auth/signup", {"name": "Bruno Test", "email": f"bruno{SUFFIX}@example.fr", "password": "bruno123"})
learner2_uid = d["user"]["id"]
call(learner2, "POST", "/me/enroll", {"formationId": free_fid})
s, d = call(learner2, "GET", "/me/formations")
titles = [f["title"] for f in d["formations"]]
check("auto-inscription gratuite + isolation", any(t.startswith("Gratuite") for t in titles), str(titles))

# ── Suivi des apprenants (équipe) ────────────────────────────────────
s, d = call(trainer, "GET", "/learners")
names = [l["name"] for l in d["learners"]]
check("formateur : apprenants de ses formations", "Paula Test" in names and "Bruno Test" in names, str(names))

s, d = call(gest, "GET", "/learners")
names = [l["name"] for l in d["learners"]]
check("gestion : tous les apprenants", "Paula Test" in names and "Bruno Test" in names, str(names))

s, d = call(trainer, "GET", f"/learners/{learner_uid}")
check("fiche apprenant (formateur, sa formation)", s == 200 and d["formations"][0]["title"].startswith("Formation Test"))

s, d = call(trainer, "GET", "/learners/progression/kanban")
# Scoping : uniquement les formations de Nina (Test + Gratuite), jamais celles du seed
ok = s == 200 and d["cards"] and all(
    c["formation"]["title"].startswith(("Formation Test", "Gratuite")) for c in d["cards"]
)
check("kanban de progression (scopé aux formations du formateur)", ok, str([c["formation"]["title"] for c in d["cards"]]))

# ── Portail apprenant ────────────────────────────────────────────────
s, d = call(learner, "GET", "/me/formations")
check("portail: mes formations", s == 200 and len(d["formations"]) == 1 and d["formations"][0]["title"].startswith("Formation Test"))

s, d = call(learner, "GET", f"/me/formations/formation-test-{SUFFIX}")
check("portail: détail formation", s == 200 and d["sections"][0]["lessons"][0]["title"] == "Leçon 1")

s, d = call(learner, "GET", f"/me/lessons/{lid}")
check("portail: lire leçon", s == 200 and d["lesson"]["content"] == "<p>Bonjour</p>")

s, d = call(learner, "PUT", f"/me/lessons/{lid}/progress", {"lastPosition": 42, "completed": True})
check("portail: progression", s == 200 and d["progress"]["completed"] is True)

s, d = call(learner, "GET", f"/me/quiz/lessons/{lid}/quiz")
check("portail: quiz sans réponses", s == 200 and "correct" not in json.dumps(d["quiz"]["choices"] if "choices" in d["quiz"] else d["quiz"]))

s, d = call(learner, "POST", f"/me/quiz/lessons/{lid}/quiz/attempt", {"answers": [[0]]})
check("portail: tentative de quiz corrigée", s == 200 and d["score"] == 1, str(d))

s, d = call(learner2, "GET", f"/me/formations/formation-test-{SUFFIX}")
check("isolation: bruno ne voit pas la formation payante", s == 403)

# ── Sécurité des rôles ────────────────────────────────────────────────
anon = client()
s, d = call(anon, "GET", "/me/formations")
check("anonyme bloqué sur /me", s == 401)

s, d = call(anon, "GET", "/learners")
check("anonyme bloqué sur /learners", s == 401)

s, d = call(learner, "GET", "/learners")
check("apprenant bloqué sur back-office (403)", s == 403)

s, d = call(trainer, "GET", "/stats/dashboard")
check("formateur bloqué sur le dashboard gestion (403)", s == 403)

s, d = call(gest, "GET", "/stats/pedagogique")
check("analytics pédagogiques (gestion)", s == 200 and "enrollmentsByMonth" in d)

# ── Sessions présentielles ───────────────────────────────────────────
from datetime import datetime, timedelta, timezone
start = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
end = (datetime.now(timezone.utc) + timedelta(days=7, hours=6)).isoformat()
s, d = call(trainer, "POST", "/sessions", {"formationId": fid, "title": "Journée Test", "startAt": start, "endAt": end, "capacity": 1})
check("formateur crée une session (formateur = lui)", s == 201 and d["session"]["trainer"]["name"] == "Nina Formatrice", str(d))
sesid = d["session"]["id"]

s, d = call(trainer, "POST", f"/sessions/{sesid}/participants", {"userIds": [learner_uid]})
check("inscrire participant", s == 201)

s, d = call(trainer, "POST", f"/sessions/{sesid}/participants", {"userIds": [learner2_uid]})
check("capacité respectée (2e participant refusé)", s == 400, str(d))

s, d = call(learner, "GET", "/me/sessions")
check("portail: mes sessions", s == 200 and len(d["sessions"]) == 1 and d["sessions"][0]["title"] == "Journée Test")

s, d = call(trainer, "PATCH", f"/sessions/{sesid}/participants/{learner_uid}", {"attended": True})
check("marquer présence", s == 200 and d["participant"]["attended"] is True)

# Le formateur seed ne gère pas cette session (autre formation)
s, d = call(seed_trainer, "DELETE", f"/sessions/{sesid}")
check("formateur étranger bloqué sur la session (403)", s == 403)

# ── Récap ────────────────────────────────────────────────────────────
passed = sum(1 for _, ok, _ in results if ok)
print(f"\n{'='*50}\n{passed}/{len(results)} tests réussis")
sys.exit(0 if passed == len(results) else 1)
