"""Request/response schemas (ninja.Schema = Pydantic). Shapes shared with the React frontend."""
from datetime import datetime
from typing import List, Optional

from ninja import Schema


# ---- input ----
class LocationIn(Schema):
    label: str
    lat: Optional[float] = None   # filled when chosen from the dropdown (skips re-geocoding)
    lon: Optional[float] = None


class TripIn(Schema):
    current: LocationIn
    pickup: LocationIn
    dropoff: LocationIn
    cycle_used: float = 0.0


class Suggestion(Schema):
    label: str
    lat: float
    lon: float


# ---- output building blocks ----
class Stop(Schema):
    type: str           # start | pickup | dropoff | fuel | rest | sleeper
    lat: float
    lon: float
    label: str


class Route(Schema):
    polyline: List[List[float]]   # [[lat, lon], ...]
    distance_miles: float
    drive_hours: float


class Segment(Schema):
    status: str         # OFF | SLEEPER | DRIVING | ONDUTY
    start: str          # ISO time
    end: str


class Remark(Schema):
    time: str
    location: str
    note: str


class DayLog(Schema):
    date: str
    total_miles: float
    segments: List[Segment]
    remarks: List[Remark]
    totals: dict        # {off, sleeper, driving, onduty} in hours
    restart: bool = False   # a 34-hr cycle restart completes on this day (resets the recap)
    edited: bool = False    # driver manually adjusted this day (pinned)


class TripOut(Schema):
    id: Optional[int] = None       # set on the plan response so the client can save edits
    cycle_used: float = 0.0        # hours already on the 70/8 clock at trip start (recap baseline)
    route: Route
    stops: List[Stop]
    logs: List[DayLog]


class LogsUpdate(Schema):
    """Driver-edited logs (totals are recomputed server-side from the segments)."""
    logs: List[DayLog]


class CascadeIn(Schema):
    """Keep the first `keep_through` days verbatim; re-simulate the remaining trip after them."""
    logs: List[DayLog]
    keep_through: int


# ---- saved trip history ----
class TripSummary(Schema):
    id: int
    current_location: str
    pickup_location: str
    dropoff_location: str
    cycle_used: float
    created_at: datetime
    distance_miles: float
    drive_hours: float
    days: int


class TripDetail(Schema):
    id: int
    current_location: str
    pickup_location: str
    dropoff_location: str
    cycle_used: float
    created_at: datetime
    result: TripOut
