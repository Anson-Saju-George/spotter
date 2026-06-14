# Spotter AI Assessment — Implementation Plan

**Stack:** Django + django-ninja + django-ninja-jwt (backend) · React + Vite (frontend)
**Goal:** Inputs (current/pickup/dropoff locations + current cycle hours) → outputs (route map with stops/rests + auto-drawn ELD daily log sheets). **Login required**, with per-user saved trip history.
**Budget:** 16 hrs / 4 days. **Graded on:** accuracy of HOS output + UI/UX quality.

**Deliverables:** GitHub repo · hosted version · 3–5 min Loom.

**Locations:**
- Frontend: `D:\Job\Spotter\app` (Vite React)
- Backend: `D:\Job\Spotter\app\backend` (Django; nested inside the app dir — Vite ignores it since it's outside `src/`)
- Run backend: `cd app/backend && python app.py`

> **Scope note:** Login + trip history is an addition beyond the original spec. It introduces a **database** (sqlite) and a `Trip` model — the backend is no longer stateless.

---

## ⚡ EXECUTION PLAN — vertical slices (build + test each feature end-to-end)

Each slice touches **both** backend and frontend and ends in a concrete test. We append as we go; nothing is "big-bang" at the end. (Detailed per-area specs are in the "Step" sections further below — these slices reference them.)

### Slice 1 — Foundations boot (BE + FE skeletons)
- **BE:** flat Django files, `settings.py` (admin+auth stack, sqlite@`data/`), `app.py` (migrate + auto-superuser + serve), stub `/api/trip`, `/admin` enabled.
- **FE:** Tailwind v4 + shadcn init + path alias; install full stack (router, query, RHF/zod, sonner, leaflet, date-fns, motion); providers in `main.jsx`; one styled placeholder page.
- ✅ **Test:** `python app.py` → `/api/docs` loads, log in to `/admin` with your email. `npm run dev` → styled page renders, no console errors.

### Slice 2 — Auth end-to-end
- **BE:** ninja-jwt login/refresh + `register`; protect `/api/trip` with `JWTAuth`.
- **FE:** `AuthContext`, `Login`/`Register` (shadcn Form + RHF/zod), axios JWT interceptor, `ProtectedRoute`, Nav + animated `Logo`.
- ✅ **Test:** register in UI → redirected in → refresh keeps session → the new user shows in `/admin`. `/api/trip` is 401 without a token.

### Slice 3 — Route on a map
- **BE:** `routing.py` (ORS geocode + directions); `/api/trip` returns `{route, stops}` only (no HOS yet).
- **FE:** `TripForm` (4 inputs) → `useMutation` → `RouteMap` (Leaflet polyline + markers); `TruckLoader` while pending.
- ✅ **Test:** enter Chicago→Detroit→Cleveland → route line + stop markers render; loader shows during fetch.

### Slice 4 — HOS engine + log data
- **BE:** `hos.py` simulation; `/api/trip` now also returns `logs: [DayLog…]`.
- **FE:** temporarily dump `logs` as JSON/table under the map to eyeball numbers.
- ✅ **Test:** short trip = 1 day ≤11h driving + pickup/dropoff hrs; 2000-mi trip = multi-day, 30-min break after 8h cumulative driving, 10h resets, ≥2 fuel stops, full-day totals = 24h.

### Slice 5 — Draw the ELD log sheets
- **FE:** `LogSheet.jsx` SVG grid (4 rows, 24h, ticks, segment lines + connectors, remarks, totals); one per day; staggered `motion` fade-in. Replace the JSON dump.
- ✅ **Test:** visual compare vs `blank-paper-log.png` (structure) + `ss/*.png` (filled shape); lines/totals match the data.

### Slice 6 — Save + trip history
- **BE:** save `Trip(user, inputs, result JSON)` on plan; `GET /api/trips`, `GET /api/trips/{id}`, `DELETE`; register `Trip` in `/admin`.
- **FE:** `MyTrips` (`useQuery` list → click re-renders saved result; `useMutation` delete + cache invalidate + toast).
- ✅ **Test:** plan → appears in My Trips and `/admin` → reopen renders same map/logs → delete removes it.

### Slice 7 — Route-truck animation + polish pass
- **FE:** truck marker drives the polyline in `RouteMap`; route/element `motion` transitions; empty/error/loading states; mobile pass; apply Asphalt & Amber palette everywhere.
- ✅ **Test:** truck animates the route smoothly; app looks cohesive on desktop + mobile; `prefers-reduced-motion` respected.

### Slice 8 — Deploy + (3D stretch) + Loom
- **Deploy** to `ansonsajugeorge.online/spotter/`: build FE (`npm run build` with `base:'/spotter/'`) → serve via nginx; run BE `SCRIPT_NAME=/spotter python app.py` behind the nginx `/spotter/api` + `/spotter/admin` proxy. Env: `ORS_API_KEY`, `SECRET_KEY`, `ADMIN_PASSWORD`, `SCRIPT_NAME=/spotter`. Same-origin → no CORS. README.
- **Stretch (only if early):** `TruckHero.jsx` 3D truck on login (react-three-fiber, lazy-loaded).
- ✅ **Test:** hosted FE talks to hosted BE end-to-end logged-in; 3 trips pass accuracy checks; record 3–5 min Loom; confirm GitHub + hosted + Loom links live.

---

## Phase 0 — Documentation Discovery (DONE — Allowed APIs)

Verified API surfaces. Do NOT invent methods/params beyond these.

### django-ninja + django-ninja-jwt
```python
from ninja import NinjaAPI, Schema
from ninja_jwt.authentication import JWTAuth
from ninja_jwt.controller import NinjaJWTDefaultController  # provides /token (login) + /token/refresh

api = NinjaAPI(auth=JWTAuth())              # global auth; mark register as auth=None
# schemas extend ninja.Schema (Pydantic wrapper), NOT pydantic.BaseModel
```
- Mount: `urlpatterns = [path("api/", api.urls)]`. Auto docs at `/api/docs`.
- ninja-jwt ships login (`/token/pair`) + refresh endpoints; we add `register` ourselves.
- Protected endpoints get `request.auth` = the authenticated User.

### OpenRouteService (free key, 2000 req/day; verified)
- **Geocode**: `GET https://api.openrouteservice.org/geocode/search?api_key=<KEY>&text=<place>&size=1`
  → `features[0].geometry.coordinates = [lon, lat]`.
- **Directions**: `POST https://api.openrouteservice.org/v2/directions/driving-car/geojson`
  - Header: `Authorization: <KEY>`; Body: `{"coordinates": [[lon,lat], ...]}` ← **[lon, lat]**
  - Response: `features[0].properties.summary.distance` (m), `.duration` (s); `features[0].geometry.coordinates` = `[[lon,lat]...]`.
- **GOTCHA:** ORS = `[lon, lat]`. Leaflet = `[lat, lon]`. Convert at the boundary.

### react-leaflet (verified)
- Install `npm i react-leaflet leaflet`; `import "leaflet/dist/leaflet.css"` once.
- `<MapContainer center={[lat,lon]}>`, `<TileLayer .../>`, `<Marker position={[lat,lon]}>`, `<Polyline positions={[[lat,lon]...]}/>`.
- **GOTCHA:** default marker icons break under Vite — apply the `L.Icon.Default` merge fix.

### Tailwind CSS v4 (current — setup changed from v3)
- Install `npm i tailwindcss @tailwindcss/vite`. **No** `init`, **no** `tailwind.config.js`, **no** postcss.
- `vite.config.js` → `plugins: [react(), tailwindcss()]`.
- `src/index.css` → single line `@import "tailwindcss";` (replaces the `@tailwind base/components/utilities` triple).
- **GOTCHA:** don't follow v3 tutorials (postcss + config file) — they won't apply.

### shadcn/ui (component layer on Tailwind)
- Init: `npx shadcn@latest init` → then add per-component: `npx shadcn@latest add button card input label`.
- CLI now supports **Tailwind v4 + React 19**; components land as `.jsx` in `src/components/ui/`.
- **Requires path alias `@` → `src`** (we're on JS, not TS): add to `vite.config.js`
  `resolve: { alias: { "@": path.resolve(__dirname, "./src") } }` **and** a `jsconfig.json` with
  `compilerOptions.paths { "@/*": ["./src/*"] }` so the CLI + imports resolve.
- Pulls in `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`; creates `components.json` + `src/lib/utils.js` (the `cn()` helper).
- **GOTCHA:** run shadcn init AFTER Tailwind v4 is set up; don't hand-create `components/ui` files — use the CLI so deps/config stay consistent.

### Best-in-class frontend stack (final)
- **Components:** shadcn/ui (Radix) + `lucide-react` icons.
- **Forms + validation:** `react-hook-form` + `zod` + `@hookform/resolvers` — shadcn's `<Form>` is built on these. Validate locations (non-empty) + `cycle_used` (number 0–70).
- **Server state:** `@tanstack/react-query` (v5) — wrap app in `<QueryClientProvider>`; `useQuery` for `GET /api/trips`, `useMutation` for plan/delete (auto loading/error + cache invalidation).
- **Toasts:** `sonner` — `<Toaster />` once; toast on save/login/errors. (shadcn's recommended toast.)
- **HTTP:** `axios` instance with JWT interceptor + 401 redirect.
- **Routing:** `react-router-dom`.
- **Map:** `react-leaflet` + `leaflet`.
- **Dates:** `date-fns` for log date/time formatting.
- **Animation:** `motion` (Framer Motion; import from `motion/react`) — transitions, logo, route-truck timing, loader.
- **3D (stretch):** `@react-three/fiber` + `@react-three/drei` + `three` — 3D truck hero on login/landing.
- Install: `npm i react-router-dom axios @tanstack/react-query react-hook-form zod @hookform/resolvers sonner date-fns react-leaflet leaflet motion`
- Stretch: `npm i three @react-three/fiber @react-three/drei`

### FMCSA HOS rules (verified from the 395 guide PDF in repo)
- **11-hour driving limit** per shift · **14-hour driving window** · **30-min break after 8 cumulative driving hrs**
- **70-hour/8-day** on-duty limit · **34-hour restart** · **10 consecutive hrs off-duty** resets 11h+14h clocks.
- **Spec assumptions:** property-carrying, 70/8, no adverse, **fuel ≥ every 1000 mi**, **1 hr pickup + 1 hr dropoff**.

---

## Backend file structure (final) — lives at `app/backend/`
```
app/backend/
├── app.py               # ⭐ SINGLE ENTRY POINT: migrate + auto-superuser + serve (python app.py). Also importable: app:application
├── manage.py            # Django CLI (migrate/shell) — kept for convenience, not needed to run
├── requirements.txt     # django, django-ninja, django-ninja-jwt, requests, django-cors-headers, uvicorn, gunicorn, whitenoise
├── settings.py          # ROOT_URLCONF="api.api"; admin+auth+sessions+messages+staticfiles+ninja_jwt; sqlite@data/; CORS; JWT; whitenoise
├── data/
│   └── db.sqlite3       # ALL data lives here (users + trips); created on first run
└── api/
    ├── __init__.py
    ├── api.py           # NinjaAPI(auth=JWTAuth()) + routers + urlpatterns (+ admin/ path)
    ├── admin.py         # register Trip in Django admin
    ├── auth.py          # register endpoint
    ├── models.py        # Trip(user FK, inputs, result JSONField, created_at)
    ├── schemas.py       # TripIn/TripOut, DayLog, Segment, Remark, Stop, RegisterIn, TripSummary
    ├── hos.py           # HOS engine
    └── routing.py       # ORS geocode + directions
```

---

## Frontend architecture (final)
**Routing (react-router):** `/login`, `/register` public; `/` (Planner) and `/trips` (MyTrips) gated by `<ProtectedRoute>`.
**State:** `AuthContext` (token+user in localStorage) for auth; **TanStack Query** for server state (trip list/plan/delete). Current trip result = `useMutation` data in `Planner`. No Redux.
**Data flow:** `TripForm` (react-hook-form + zod) submit → `useMutation(api.planTrip)` → result → `RouteMap` + `LogSheet`. `MyTrips` uses `useQuery(api.listTrips)`. Frontend is render-only; engine does the math. `sonner` toasts on success/error.
**Providers (main.jsx):** `<QueryClientProvider>` → `<AuthProvider>` → `<BrowserRouter>` → `<App/>` + `<Toaster/>`.
**Styling:** Tailwind v4 + shadcn/ui components (Button, Card, Input, Label, Form via CLI).

### Color palette — "Asphalt & Amber"
| Role | Token | Hex |
|---|---|---|
| Primary (CTAs, accents, route line) | amber-500 | `#F59E0B` |
| Primary hover | amber-600 | `#D97706` |
| Foreground text | slate-900 | `#0F172A` |
| Dark surface (nav, footer) | slate-800 | `#1E293B` |
| App background | slate-50 | `#F8FAFC` |
| Muted/borders | slate-200/400 | `#E2E8F0` / `#94A3B8` |
- Map to shadcn theme vars in `index.css` (`--primary` = amber, `--background` = slate-50, `--foreground` = slate-900, dark nav uses slate-800). Tailwind v4 = define via `@theme`/CSS vars.
- **Log sheets stay authentic blue-on-white** (`#1D4ED8` grid lines) as *content* — they intentionally contrast the amber chrome.
- Truck/flair elements use amber; route polyline = amber, the animated truck marker rides it.

```
app/
├── jsconfig.json          # "@/*" path alias (for shadcn imports)
├── components.json        # shadcn config
├── vite.config.js         # react + tailwindcss plugins + "@" resolve alias
└── src/
    ├── main.jsx           # Router + <AuthProvider>
    ├── App.jsx            # route table
    ├── index.css          # @import "tailwindcss"; + shadcn theme vars
    ├── api.js             # axios instance + Bearer interceptor + 401 redirect + endpoint fns
    ├── auth.jsx           # AuthContext + useAuth + <ProtectedRoute> (combined, 1 file)
    ├── lib/
    │   └── utils.js       # cn() helper (created by shadcn)
    └── components/
        ├── ui/            # shadcn components (CLI-generated: button.jsx, card.jsx, input.jsx, label.jsx ...)
        ├── Login.jsx
        ├── Register.jsx
        ├── Nav.jsx        # brand + links + logout
        ├── TripForm.jsx   # 4 inputs (current, pickup, dropoff, cycle_used) — shadcn Input/Button
        ├── RouteMap.jsx   # Leaflet: Polyline + Markers (icon fix), popups per stop
        ├── LogSheet.jsx   # ⭐ SVG ELD grid, data-driven from one DayLog
        ├── Planner.jsx    # form + results (map + stacked LogSheets) — shadcn Card layout
        └── MyTrips.jsx    # GET /api/trips list → click re-renders saved result, delete
```
> Our own components use PascalCase (`TripForm.jsx`); shadcn's live lowercase under `components/ui/`. Keep them separate.

### Deployment base path — served at `ansonsajugeorge.online/spotter/`
App lives under the `/spotter/` subpath on Anson's server (nginx reverse-proxies to `python app.py`). **Same-origin → no prod CORS needed.** All API calls route through the domain by default.

**Vite (`vite.config.js`):**
```js
export default defineConfig({
  base: '/spotter/',                       // assets + router resolve under /spotter/
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {                                // DEV: proxy API to local Django, strip /spotter
    proxy: {
      '/spotter/api':   { target: 'http://localhost:8000', changeOrigin: true, rewrite: p => p.replace(/^\/spotter/, '') },
      '/spotter/admin': { target: 'http://localhost:8000', changeOrigin: true, rewrite: p => p.replace(/^\/spotter/, '') },
    },
  },
})
```
**Router:** `<BrowserRouter basename="/spotter">` → routes become `/spotter/login`, `/spotter/trips`, etc.
**axios (`api.js`):** `baseURL: import.meta.env.BASE_URL + 'api'` → `/spotter/api` (relative, same-origin). Works in dev (Vite proxy → Django) and prod (nginx → Django) with **no `VITE_API_URL` needed**.

**Django (`settings.py`)** behind the subpath:
- `FORCE_SCRIPT_NAME = os.environ.get("SCRIPT_NAME", "")  # set "/spotter" in prod` → correct admin/redirect URLs.
- `STATIC_URL = "/spotter/static/"`; `CSRF_TRUSTED_ORIGINS = ["https://ansonsajugeorge.online"]`.
- URL patterns stay `api/`, `admin/` (proxy strips `/spotter`). Prod CORS optional (same origin); keep dev CORS for `localhost:5173`.

**nginx (server):**
```nginx
location /spotter/        { root /var/www; try_files $uri /spotter/index.html; }  # built FE (SPA fallback)
location /spotter/api/    { proxy_pass http://127.0.0.1:8000/api/; }
location /spotter/admin/  { proxy_pass http://127.0.0.1:8000/admin/; }
location /spotter/static/ { proxy_pass http://127.0.0.1:8000/static/; }
```
Run Django with `SCRIPT_NAME=/spotter python app.py` so generated links carry the prefix.

### LogSheet.jsx rendering contract
- **X = time:** `x(t) = left + (t/24)*gridW`; 24 hour columns + 15-min ticks.
- **Y = 4 rows:** Off / Sleeper / Driving / On-Duty (fixed order).
- Per segment: horizontal line on its row `x(start)→x(end)` + vertical connector to next segment's row.
- Remarks: angled location/note labels under grid at each change.
- Right edge: per-status hour totals + circled (driving+onduty) total.
- One `<LogSheet>` per `DayLog`, stacked.
- **Refs:** `blank-paper-log.png` (structure), `ss/*.png` (filled look), PDF pp.15–19 (spec).

---

## UI Flair & Animation (all 4 selected; 3D = stretch)

1. **Truck animates the route** ⭐ — a truck-icon Leaflet marker drives along the route polyline.
   Impl: `requestAnimationFrame` interpolating position along the polyline coords by cumulative distance; play/pause control. Lives in `RouteMap.jsx`. Use a custom `L.divIcon` (lucide Truck / emoji) so it rotates toward heading.
2. **Themed truck loader** 🚚 — replaces the spinner during the plan mutation. A small truck drives across with a dashed road; `motion` loop. Component `TruckLoader.jsx`; shown while `useMutation` isPending.
3. **Logo + motion transitions** ✨ — `Logo.jsx` (lucide `Truck` + "Spotter" wordmark) with a subtle draw/slide on mount; route + element transitions via `motion` (`<AnimatePresence>` on route change, staggered fade/slide for stacked `LogSheet`s and result cards).
4. **3D truck hero (stretch)** 🧊 — `TruckHero.jsx` on the login/landing screen: react-three-fiber `<Canvas>` + drei (`OrbitControls`, `Environment`, `useGLTF`) loading a free CC0 truck GLTF. **Only after Steps 1–8 pass.** Lazy-load to keep the main bundle lean; fallback to the 2D logo if it doesn't fit the budget.

**Guard:** keep animations GPU-friendly (transform/opacity only); respect `prefers-reduced-motion`; lazy-load the 3D canvas so it never blocks first paint.

---

## Step 1 — Skeleton + DB
**Build:** flat Django + ninja files; `settings.py` with `INSTALLED_APPS=[admin, auth, contenttypes, sessions, messages, staticfiles, ninja_jwt]`, sqlite at `data/db.sqlite3` (`DATABASES` uses `BASE_DIR/"data"/"db.sqlite3"`), `MIDDLEWARE` includes whitenoise + sessions + auth + messages + CORS, `STATIC_ROOT`, CORS, `ROOT_URLCONF="api.api"`, `DEBUG=True`, `ALLOWED_HOSTS=["*"]`. `api.py` urlpatterns include `path("admin/", admin.site.urls)`. Empty `Trip` model placeholder + `api/admin.py` registering it. Stub `/api/trip` (auth off for now). Write `app.py` single entry point (see below).
**Run:** `python app.py` (auto-runs migrate on boot, then serves on `$PORT` or 8000). For dev with auto-reload, optionally `python manage.py runserver`.
**Verify:** `python app.py` → `/api/docs` loads; migrate runs clean; stub `/api/trip` returns 200.
**Guard:** hand-write flat files; do NOT `startproject`/`startapp`.

### `app.py` — the single entry point (run + host + admin)
```python
import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings")

import django
django.setup()

# 1) ensure DB schema exists on every boot (idempotent)
from django.core.management import call_command
call_command("migrate", interactive=False)

# 2) auto-create the admin superuser (idempotent) -> full /admin access
from django.contrib.auth import get_user_model
User = get_user_model()
admin_email = os.environ.get("ADMIN_EMAIL", "ansonsaju2004@gmail.com")
admin_pass = os.environ.get("ADMIN_PASSWORD")          # set in env; NEVER commit
if admin_pass and not User.objects.filter(username=admin_email).exists():
    User.objects.create_superuser(admin_email, admin_email, admin_pass)

# 3) the ASGI app — importable as app:application by gunicorn/uvicorn too
from django.core.asgi import get_asgi_application
application = get_asgi_application()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(application, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
```
- **Local / your server:** `python app.py` — migrates, seeds admin, serves. Matches your `python app.py` workflow exactly.
- **uvicorn or gunicorn:** `python app.py` (uvicorn inside), OR `gunicorn app:application -k uvicorn.workers.UvicornWorker -b 0.0.0.0:$PORT` for prod — `application` is importable either way.
- **Admin:** visit `/admin`, log in with your email + `ADMIN_PASSWORD` → see/edit all users + trips. (Needs `whitenoise` so admin CSS works when `DEBUG=False`.)
- **No separate `asgi.py`** — `app.py` is runner + importable ASGI module.

## Step 2 — Auth (backend)
**Build:** register ninja-jwt controller (login + refresh), `auth.py` register endpoint (creates Django User, `auth=None`). Set `NinjaAPI(auth=JWTAuth())` so `/api/trip` requires a token.
**Verify:** register → login (get access token) → `/api/trip` with `Authorization: Bearer <token>` = 200; without = 401.
**Guard:** never store plaintext passwords (use `User.objects.create_user`). Return 409 on duplicate username/email.

## Step 3 — HOS engine (`hos.py`) — CORE
**Build:** `build_logs(distance_miles, drive_seconds, cycle_used_hrs, start_dt) -> list[DayLog]` as an event simulation.
State: `clock`, `cycle_used`, `drive_today`(→11h), `drive_since_break`(→8h), `shift_start`(→14h), `miles`.
Emit `segments`(status∈OFF/SLEEPER/DRIVING/ONDUTY, start, end) + `remarks`(time, location, note).
Trip composition: drive current→pickup, **1h ON_DUTY pickup**, drive pickup→dropoff, **1h ON_DUTY dropoff**; insert **fuel stop (ON_DUTY ~30m) every 1000 mi**.
Rule loop (15-min increments): if `drive_since_break>=8h`→30-min OFF break; if `drive_today>=11h` or 14h window elapsed→10-h SLEEPER reset; if `cycle_used>=70h`→34-h restart; else drive one increment.
**Split across midnight** → group by date → one `DayLog`/day with `segments`, `remarks`, `totals`(per status, =24h full days), `total_miles`.
**Verify:** short trip→1 day, driving≤11h, has pickup+dropoff hrs; 2000-mi trip→multi-day, 30-min break before 8h cumulative driving, 10h sleeper between days, ≥2 fuel stops, full-day totals=24h.
**Guard:** derive day count from simulation; 30-min break is keyed to **cumulative** driving.

## Step 4 — Routing (`routing.py`) + wire endpoint + save Trip
**Build:** `geocode(place)->(lat,lon)`; `get_route([(lat,lon)...])->{distance_miles, drive_seconds, polyline:[[lat,lon]...]}` (send `[lon,lat]`, convert back). Key from `ORS_API_KEY` env. Wire `/api/trip`: geocode 3 → route → `hos.build_logs` → build `stops` (interpolate coords along polyline by cumulative distance) → **save `Trip`(user, inputs, result JSON)** → return `TripOut`. Add `GET /api/trips` (list user's), `GET /api/trips/{id}`, `DELETE /api/trips/{id}`.
**Verify:** real trip (Chicago→Detroit→Cleveland) → 200 with polyline + DayLogs; the trip appears in `GET /api/trips`.
**Guard:** scope trip queries to `request.auth` (no cross-user access); handle ORS errors with 4xx not 500.

## Step 5 — Frontend setup + Auth
**Setup first:** Tailwind v4 (`npm i tailwindcss @tailwindcss/vite`, plugin + `@import`), path alias in `vite.config.js` + `jsconfig.json`, then `npx shadcn@latest init` and add `button card input label form sonner`. Install full stack: `npm i react-router-dom axios @tanstack/react-query react-hook-form zod @hookform/resolvers sonner date-fns react-leaflet leaflet`. Wire providers in `main.jsx` (QueryClient → Auth → Router) + `<Toaster/>`.
**Build:** `AuthContext` (token in localStorage), `Login.jsx`/`Register.jsx` (shadcn Form + react-hook-form + zod), axios instance with auth header + 401 redirect, `ProtectedRoute`. Toast on login success/failure. **Flair:** `Logo.jsx` (animated) in Nav + auth cards; wrap routes in `<AnimatePresence>` for page transitions.
**Verify:** unauthenticated → redirected to login; after login → app loads; refresh keeps session.
**Guard:** clear token on logout/401; don't hardcode the backend URL (use `VITE_API_URL`).

## Step 6 — Form + Map
**Build:** `TripForm.jsx` (shadcn Form + react-hook-form + zod, 4 fields), `api.js` POST `/api/trip` via `useMutation`, `RouteMap.jsx` (MapContainer + TileLayer + Polyline + Markers w/ popups; icon fix). **Flair:** `TruckLoader.jsx` shown while mutation isPending; animated truck marker driving the route polyline in `RouteMap`; staggered `motion` fade-in for result cards. Toast on failure.
**Verify:** submit → route polyline + stop markers render.
**Guard:** convert ORS `[lon,lat]`→Leaflet `[lat,lon]`.

## Step 7 — ELD log drawing (`LogSheet.jsx`)
**Build:** SVG grid per `DayLog`: header (date, miles, totals), 4 status rows, 24 hour columns w/ 15-min ticks, segment lines + vertical connectors, remarks (angled location/note labels), per-status hour totals + circled drive+onduty total. Render one sheet per day.
**Verify:** structure matches `blank-paper-log.png`; filled shape matches `ss/*.png`; lines/totals match segment data. Refs: PDF pp.15–19.
**Guard:** off-by-one on the 24h→x mapping; ensure totals re-sum from segments.

## Step 8 — Trip history + Polish + Deploy
**Build:** `MyTrips.jsx` (`useQuery` → `GET /api/trips`, click → re-render saved result, `useMutation` delete → invalidate list; toast on delete). UI/UX pass (layout, spacing, states, mobile). Deploy to `ansonsajugeorge.online/spotter/`: built FE via nginx, BE via `SCRIPT_NAME=/spotter python app.py` behind nginx `/spotter/api` proxy (same-origin, no CORS); env `ORS_API_KEY` + `SECRET_KEY` + `ADMIN_PASSWORD` + `SCRIPT_NAME`; migrate + admin seed run automatically on boot. README + record 3–5 min Loom.
**Verify:** hosted, logged-in, end-to-end; history persists across sessions.

## Step 9 — Final Verification
1. Accuracy: 3 trips (short/medium/2000+ mi) — driving≤11h/day, 30-min break after 8h, 10h resets, fuel every ~1000mi, 1h pickup+dropoff, day totals=24h, multi-sheet for long trips.
2. Auth: protected endpoints 401 without token; trips scoped per user.
3. Anti-pattern grep: no committed `ORS_API_KEY`/`SECRET_KEY`; no ORS `[lon,lat]` leaking into Leaflet.
4. All 3 deliverable links live (GitHub public, hosted, Loom).

---

## Time budget (16h target)
P1 skeleton+DB 1h · P2 auth-be 1.5h · P3 HOS 4h · P4 routing+save 2h · P5 auth-fe+logo 2h · P6 form+map+loader+route-truck 3h · P7 log drawing 3h · P8 history+polish+deploy 2.5h · P9 verify 0.5h
**Flair adds ~2–3h** (loader, route-truck, transitions baked into P5/P6). **3D truck hero = +2–3h stretch, only if early.**
Raw ≈ 19.5h + 3D. **To hit 16h:** the engine (P3) + log drawing (P7) + accuracy are non-negotiable; the droppable order if time runs short is: **3D truck → trip history → route-truck animation → other transitions.** Keep the themed loader + logo (cheap, high charm).
