# 🚛 Spotter

Full-stack trip planner for property-carrying truck drivers. Enter a trip, get an
interactive route map **and** auto-drawn, FMCSA-compliant ELD daily log sheets — which
you can then **edit by hand**, with the rest of the trip re-planning around your changes.

**Live:** https://ansonsajugeorge.online/spotter/

## Features

- **Trip planning** — current / pickup / dropoff locations (city autocomplete) + current cycle hours
- **Route map** — driving route, stops, fuel & rest markers, and an animated truck (Leaflet + OpenRouteService)
- **HOS engine** — simulates the trip under FMCSA rules: 11-hr driving, 14-hr window, 30-min break,
  10-hr reset, 70-hr/8-day cycle with 34-hr restart, 1-hr pickup/dropoff, fuel every ≤1000 mi
- **ELD log sheets** — one DOT-style Record-of-Duty-Status grid per day, drawn in SVG, with totals,
  remarks, and a 70-hr/8-day recap
- **Editable logs** — tap/drag/paint duty status on the grid; edits cascade forward so untouched
  days re-simulate and the trip grows/shrinks; per-day reset to the ideal plan
- **Auth + history** — JWT login/register, every plan saved, revisit or delete past trips
- **Print-ready** logs and a polished, animated UI

## Tech stack

- **Frontend:** React 19, Vite, Tailwind v4, shadcn/ui, TanStack Query, react-hook-form + zod,
  react-leaflet, Framer Motion, sonner
- **Backend:** Django 5 + django-ninja (NinjaExtraAPI) + django-ninja-jwt, SQLite, served with uvicorn
- **Maps/Routing:** OpenRouteService (geocoding + directions)

## Project structure

```
app/                 # Vite React frontend (root)
  src/               # components, api client, auth
  backend/           # Django backend
    app.py           # single entry point: migrate + seed admin + serve
    settings.py      # flat settings; ROOT_URLCONF = api.api
    api/             # api.py (routes), hos.py (HOS engine), routing.py (ORS), schemas, models
```

## Local development

**Backend** (`app/backend/`):
```bash
python -m venv .venv && . .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # then fill in ORS_API_KEY, ADMIN_EMAILS, ADMIN_PASSWORD
python app.py              # migrates, seeds admin, serves on :8000
```

**Frontend** (`app/`):
```bash
npm install
npm run dev                # http://localhost:5173/spotter/  (proxies /spotter/api -> :8000)
```

## Environment variables (`app/backend/.env`)

| Key | Purpose |
|-----|---------|
| `ORS_API_KEY` | OpenRouteService key (geocoding + directions) — **server-side only** |
| `ADMIN_EMAILS` | comma-separated allowlist auto-elevated to superuser |
| `ADMIN_PASSWORD` | password synced for the admin accounts on boot |
| `SECRET_KEY` | Django secret (set a random value in production) |
| `DEBUG` | `1` for dev, `0` for production |

## Deployment

Built under the `/spotter/` base path. The frontend `dist/` is served statically by nginx and
`/spotter/api/*` is reverse-proxied to the Django backend (gunicorn + uvicorn worker). See the
backend `app.py` for the production entry point.
