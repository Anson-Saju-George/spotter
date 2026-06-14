"""OpenRouteService geocoding + directions.

ORS uses [lon, lat]; we convert to [lat, lon] at the boundary for Leaflet.
"""
import os

import requests

ORS_BASE = "https://api.openrouteservice.org"
METERS_PER_MILE = 1609.34


class RoutingError(Exception):
    """User-facing routing failure (bad location, service down, no key)."""


def _key():
    key = os.environ.get("ORS_API_KEY", "")
    if not key:
        raise RoutingError("Routing is not configured (missing ORS_API_KEY).")
    return key


def geocode(place: str):
    """Place name -> (lat, lon, label). Raises RoutingError if not found."""
    try:
        r = requests.get(
            f"{ORS_BASE}/geocode/search",
            params={"api_key": _key(), "text": place, "size": 1, "boundary.country": "US", "layers": "locality"},
            timeout=15,
        )
        r.raise_for_status()
        features = r.json().get("features", [])
    except requests.RequestException:
        raise RoutingError("Could not reach the geocoding service.")
    if not features:
        raise RoutingError(f"Could not find location: {place!r}")
    lon, lat = features[0]["geometry"]["coordinates"]
    label = features[0].get("properties", {}).get("label", place)
    return lat, lon, label


def autocomplete(text: str, size: int = 5):
    """Partial text -> list of {label, lat, lon} suggestions for the dropdown."""
    try:
        r = requests.get(
            f"{ORS_BASE}/geocode/autocomplete",
            params={"api_key": _key(), "text": text, "size": size, "boundary.country": "US", "layers": "locality"},
            timeout=10,
        )
        r.raise_for_status()
        features = r.json().get("features", [])
    except requests.RequestException:
        raise RoutingError("Could not reach the geocoding service.")
    suggestions = []
    for f in features:
        coords = f.get("geometry", {}).get("coordinates")
        label = f.get("properties", {}).get("label")
        if coords and label:
            suggestions.append({"label": label, "lat": coords[1], "lon": coords[0]})
    return suggestions


def get_route(points):
    """[(lat, lon), ...] -> {distance_miles, drive_seconds, polyline:[[lat,lon],...]}."""
    coords = [[lon, lat] for (lat, lon) in points]  # ORS wants [lon, lat]
    try:
        r = requests.post(
            f"{ORS_BASE}/v2/directions/driving-car/geojson",
            headers={"Authorization": _key(), "Content-Type": "application/json"},
            json={"coordinates": coords},
            timeout=30,
        )
        r.raise_for_status()
        feature = r.json()["features"][0]
    except requests.RequestException:
        raise RoutingError("Could not compute a route for those locations.")
    except (KeyError, IndexError):
        raise RoutingError("No route found between those locations.")

    summary = feature["properties"]["summary"]
    polyline = [[lat, lon] for lon, lat in feature["geometry"]["coordinates"]]  # -> [lat, lon]
    # one entry per leg between consecutive waypoints (e.g. current->pickup, pickup->dropoff)
    legs = [
        {"distance_miles": round(s["distance"] / METERS_PER_MILE, 1), "drive_seconds": s["duration"]}
        for s in feature["properties"].get("segments", [])
    ]
    return {
        "distance_miles": round(summary["distance"] / METERS_PER_MILE, 1),
        "drive_seconds": summary["duration"],
        "polyline": polyline,
        "legs": legs,
    }
