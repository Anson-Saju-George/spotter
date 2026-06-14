"""NinjaExtraAPI + URL config. This module IS the ROOT_URLCONF (settings.ROOT_URLCONF = "api.api").

JWT login/refresh come from NinjaJWTDefaultController -> /api/token/pair, /api/token/refresh, /api/token/verify.
"""
from django.contrib import admin
from django.shortcuts import get_object_or_404
from django.urls import path
from ninja.errors import HttpError
from ninja_extra import NinjaExtraAPI
from ninja_jwt.authentication import JWTAuth
from ninja_jwt.controller import NinjaJWTDefaultController

from datetime import date, datetime, time, timedelta
from typing import List

from .auth import router as auth_router
from .hos import build_logs
from .models import Trip
from .routing import RoutingError, autocomplete, geocode, get_route
from .schemas import CascadeIn, LogsUpdate, Suggestion, TripDetail, TripIn, TripOut, TripSummary

api = NinjaExtraAPI(title="Spotter API", version="1.0.0")
api.register_controllers(NinjaJWTDefaultController)  # /token/pair (login), /token/refresh, /token/verify
api.add_router("/auth", auth_router)                 # /auth/register, /auth/me


@api.get("/health", auth=None)
def health(request):
    return {"status": "ok"}


@api.get("/geocode/autocomplete", response=List[Suggestion], auth=JWTAuth())
def geocode_autocomplete(request, text: str):
    """Location typeahead — returns up to 5 {label, lat, lon} suggestions."""
    text = (text or "").strip()
    if len(text) < 2:
        return []
    try:
        return autocomplete(text)
    except RoutingError:
        return []


def _resolve(loc):
    """Use the dropdown-selected coords if present, else geocode the typed label."""
    if loc.lat is not None and loc.lon is not None:
        return loc.lat, loc.lon, loc.label
    return geocode(loc.label)


@api.post("/trip", response=TripOut, auth=JWTAuth())
def plan_trip(request, payload: TripIn):
    """Resolve the 3 locations, compute the driving route, return route + stops.

    HOS log generation is added in Slice 4.
    """
    try:
        cur = _resolve(payload.current)
        pick = _resolve(payload.pickup)
        drop = _resolve(payload.dropoff)
        if (round(pick[0], 4), round(pick[1], 4)) == (round(drop[0], 4), round(drop[1], 4)):
            raise HttpError(422, "Pickup and dropoff can't be the same location.")
        route = get_route([(cur[0], cur[1]), (pick[0], pick[1]), (drop[0], drop[1])])
    except RoutingError as e:
        raise HttpError(422, str(e))

    stops = [
        {"type": "start", "lat": cur[0], "lon": cur[1], "label": cur[2]},
        {"type": "pickup", "lat": pick[0], "lon": pick[1], "label": pick[2]},
        {"type": "dropoff", "lat": drop[0], "lon": drop[1], "label": drop[2]},
    ]

    # HOS: drive current->pickup (load 1 hr), then pickup->dropoff (unload 1 hr)
    arrivals = [
        {"label": pick[2], "event": "Pickup", "duration": 1.0},
        {"label": drop[2], "event": "Dropoff", "duration": 1.0},
    ]
    legs = [
        {"miles": leg["distance_miles"], "hours": leg["drive_seconds"] / 3600, "arrive": arrivals[i]}
        for i, leg in enumerate(route["legs"][:2])
    ]
    start_dt = datetime.combine(date.today(), time(hour=8))  # clean 08:00 start for the logs
    logs = build_logs(legs, payload.cycle_used, start_dt, start_label=cur[2])

    out = {
        "route": {
            "polyline": route["polyline"],
            "distance_miles": route["distance_miles"],
            "drive_hours": round(route["drive_seconds"] / 3600, 1),
        },
        "stops": stops,
        "logs": logs,
        # kept server-side so log edits can re-simulate the remaining days (not returned to client)
        "plan": {"legs": legs, "start_label": cur[2], "start": start_dt.isoformat()},
    }
    # save to the user's history (each plan is a record)
    trip = Trip.objects.create(
        user=request.auth,
        current_location=cur[2],
        pickup_location=pick[2],
        dropoff_location=drop[2],
        cycle_used=payload.cycle_used,
        result=out,
    )
    out["id"] = trip.id  # let the client save log edits against this trip
    out["cycle_used"] = payload.cycle_used  # recap baseline for the client
    return out


def _summary(trip):
    route = (trip.result or {}).get("route", {})
    return {
        "id": trip.id,
        "current_location": trip.current_location,
        "pickup_location": trip.pickup_location,
        "dropoff_location": trip.dropoff_location,
        "cycle_used": trip.cycle_used,
        "created_at": trip.created_at,
        "distance_miles": route.get("distance_miles", 0.0),
        "drive_hours": route.get("drive_hours", 0.0),
        "days": len((trip.result or {}).get("logs", [])),
    }


def _detail(trip):
    return {
        "id": trip.id,
        "current_location": trip.current_location,
        "pickup_location": trip.pickup_location,
        "dropoff_location": trip.dropoff_location,
        "cycle_used": trip.cycle_used,
        "created_at": trip.created_at,
        "result": trip.result,
    }


@api.get("/trips", response=List[TripSummary], auth=JWTAuth())
def list_trips(request):
    """The signed-in user's saved trips, newest first."""
    return [_summary(t) for t in Trip.objects.filter(user=request.auth)]


@api.get("/trips/{trip_id}", response=TripDetail, auth=JWTAuth())
def get_trip(request, trip_id: int):
    return _detail(get_object_or_404(Trip, id=trip_id, user=request.auth))


@api.delete("/trips/{trip_id}", auth=JWTAuth())
def delete_trip(request, trip_id: int):
    Trip.objects.filter(id=trip_id, user=request.auth).delete()
    return {"ok": True}


_TOTAL_KEY = {"OFF": "off", "SLEEPER": "sleeper", "DRIVING": "driving", "ONDUTY": "onduty"}


def _recompute_totals(segments):
    """Sum each duty status from the (possibly edited) segment times — the server is authoritative."""
    totals = {"off": 0.0, "sleeper": 0.0, "driving": 0.0, "onduty": 0.0}
    for s in segments:
        hours = (datetime.fromisoformat(s["end"]) - datetime.fromisoformat(s["start"])).total_seconds() / 3600
        totals[_TOTAL_KEY[s["status"]]] += hours
    return {k: round(v, 2) for k, v in totals.items()}


@api.patch("/trips/{trip_id}", response=TripDetail, auth=JWTAuth())
def update_trip_logs(request, trip_id: int, payload: LogsUpdate):
    """Persist driver edits to a trip's daily logs (route/stops are unchanged)."""
    trip = get_object_or_404(Trip, id=trip_id, user=request.auth)
    result = trip.result or {}
    logs = []
    for day in payload.logs:
        d = day.dict()
        d["totals"] = _recompute_totals(d["segments"])
        logs.append(d)
    result["logs"] = logs
    trip.result = result
    trip.save(update_fields=["result"])
    return _detail(trip)


def _leg_speeds(legs):
    """[(start_mile, end_mile, mph), ...] cumulative along the route."""
    bounds, cum = [], 0.0
    for leg in legs:
        speed = leg["miles"] / leg["hours"] if leg["hours"] > 1e-9 else 1e9
        bounds.append((cum, cum + leg["miles"], speed))
        cum += leg["miles"]
    return bounds


def _checkpoint(kept_days, legs, cycle_start):
    """Walk the kept (edited/verbatim) days -> (cycle_used, miles_driven) at their end."""
    bounds = _leg_speeds(legs)
    total = bounds[-1][1] if bounds else 0.0

    def speed_at(m):
        for a, b, s in bounds:
            if m < b - 1e-9:
                return s
        return bounds[-1][2] if bounds else 1e9

    cycle, miles = cycle_start, 0.0
    for d in kept_days:
        if d.get("restart"):
            cycle = 0.0
        for seg in d["segments"]:
            hrs = (datetime.fromisoformat(seg["end"]) - datetime.fromisoformat(seg["start"])).total_seconds() / 3600
            if seg["status"] == "DRIVING":
                miles += hrs * speed_at(miles)
                cycle += hrs
            elif seg["status"] == "ONDUTY":
                cycle += hrs
    return cycle, min(miles, total)


def _remaining_legs(legs, miles_done):
    """The legs still to drive after `miles_done` — done legs (and their pickup/dropoff) drop off."""
    out, cum = [], 0.0
    for leg in legs:
        leg_end = cum + leg["miles"]
        if miles_done < leg_end - 1e-6:
            start = max(miles_done, cum)
            rem = leg_end - start
            speed = leg["miles"] / leg["hours"] if leg["hours"] > 1e-9 else 1e9
            out.append({"miles": round(rem, 1), "hours": rem / speed, "arrive": leg["arrive"]})
        cum = leg_end
    return out


@api.post("/trips/{trip_id}/cascade", response=TripDetail, auth=JWTAuth())
def cascade_logs(request, trip_id: int, payload: CascadeIn):
    """Keep the first `keep_through` days as the driver left them; re-simulate the rest of the trip.

    This is what makes an edit "flow forward": untouched later days redraw from the new state,
    and the trip grows or shrinks days as the remaining work changes.
    """
    trip = get_object_or_404(Trip, id=trip_id, user=request.auth)
    result = trip.result or {}
    incoming = [d.dict() for d in payload.logs]
    keep = max(0, min(payload.keep_through, len(incoming)))
    kept = incoming[:keep]
    for d in kept:
        d["totals"] = _recompute_totals(d["segments"])  # server-authoritative totals

    plan = result.get("plan")
    if not plan:  # older trip without stored plan -> can't re-simulate, just persist
        result["logs"] = kept + incoming[keep:]
        trip.result = result
        trip.save(update_fields=["result"])
        return _detail(trip)

    legs = plan["legs"]
    cycle_cp, miles_done = _checkpoint(kept, legs, trip.cycle_used)
    remaining = _remaining_legs(legs, miles_done)

    if kept:
        last_date = date.fromisoformat(kept[-1]["date"])
        cont_start = datetime.combine(last_date + timedelta(days=1), time(hour=8))
        note = "Resuming trip"
    else:
        cont_start = datetime.fromisoformat(plan["start"])
        note = "Trip start"

    continuation = (
        build_logs(remaining, cycle_cp, cont_start, start_label=plan.get("start_label", "Start"), start_note=note)
        if remaining
        else []
    )
    result["logs"] = kept + continuation
    trip.result = result
    trip.save(update_fields=["result"])
    return _detail(trip)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
]
