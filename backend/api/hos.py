"""HOS engine — simulate a property-carrying driver's trip under FMCSA 70hr/8day rules
and emit filled, per-day ELD logs.

Assumptions (from the assessment brief):
  * property-carrying driver, 70 hrs / 8 days, no adverse driving conditions
  * 11-hr driving limit and 14-hr on-duty window per duty period
  * 30-min break required after 8 cumulative hrs of driving
  * 10 consecutive hrs off resets the daily limits; 34 hrs off restarts the cycle
  * 1 hr on-duty at pickup and at dropoff; fuel (30 min on-duty) at least every 1,000 mi

A leg is {"miles", "hours", "arrive": {"label", "event", "duration"}}; the simulator
drives each leg (inserting breaks/rests/fuel as the rules require) then performs the
on-duty event at the destination. The timeline is split at midnight into DayLog dicts.
"""
from datetime import date, datetime, time, timedelta

# duty-status codes (match schemas.Segment.status and the four log-sheet rows)
OFF, SLEEPER, DRIVING, ONDUTY = "OFF", "SLEEPER", "DRIVING", "ONDUTY"
_TOTAL_KEY = {OFF: "off", SLEEPER: "sleeper", DRIVING: "driving", ONDUTY: "onduty"}

MAX_DRIVE = 11.0        # driving hrs per duty period
MAX_WINDOW = 14.0       # on-duty window (wall clock) per duty period
BREAK_AFTER = 8.0       # driving hrs before a 30-min break is required
BREAK_LEN = 0.5
DAILY_RESET = 10.0      # consecutive hrs off to reset the 11/14 limits
CYCLE_LIMIT = 70.0      # on-duty hrs allowed in 8 days
CYCLE_RESTART = 34.0    # consecutive hrs off to restart the cycle
FUEL_EVERY = 1000.0     # miles between fuel stops (at most)
FUEL_LEN = 0.5          # hrs on-duty per fuel stop
EPS = 1e-6


class _Sim:
    """Walks a clock forward, emitting duty segments while honoring the HOS limits."""

    def __init__(self, cycle_used, start_dt):
        self.clock = start_dt
        self.cycle_used = cycle_used                      # on-duty hrs used in the rolling 8-day cycle
        self.drive_left = MAX_DRIVE                       # driving hrs left this duty period
        self.window_end = start_dt + timedelta(hours=MAX_WINDOW)
        self.drive_since_break = 0.0                      # driving hrs since the last 30-min break
        self.miles_since_fuel = 0.0
        self.segments = []                                # {status, start, end, miles}
        self.remarks = []                                 # {time, location, note}

    def _add(self, status, hours, miles=0.0, location="En route", note=None):
        start = self.clock
        self.clock = start + timedelta(hours=hours)
        self.segments.append({"status": status, "start": start, "end": self.clock, "miles": miles})
        if note:
            self.remarks.append({"time": start, "location": location, "note": note})

    def _begin_duty_period(self):
        self.drive_left = MAX_DRIVE
        self.window_end = self.clock + timedelta(hours=MAX_WINDOW)
        self.drive_since_break = 0.0

    def _daily_reset(self):
        self._add(SLEEPER, DAILY_RESET, note="10-hr reset")
        self._begin_duty_period()

    def _cycle_restart(self):
        self._add(SLEEPER, CYCLE_RESTART, note="34-hr restart")
        self.cycle_used = 0.0
        self._begin_duty_period()

    def remark(self, location, note):
        self.remarks.append({"time": self.clock, "location": location, "note": note})

    def on_duty(self, hours, location, note):
        """Pickup / dropoff / fuel — on-duty (not driving) time; counts toward the 70."""
        self._add(ONDUTY, hours, location=location, note=note)
        self.cycle_used += hours

    def drive(self, miles, hours):
        speed = miles / hours if hours > EPS else 0.0
        remaining = hours
        while remaining > EPS:
            if self.cycle_used >= CYCLE_LIMIT - EPS:          # 70-hr cycle used up
                self._cycle_restart()
            window_left = (self.window_end - self.clock).total_seconds() / 3600
            if self.drive_left <= EPS or window_left <= EPS:  # 11-hr drive / 14-hr window
                self._daily_reset()
                continue
            if self.drive_since_break >= BREAK_AFTER - EPS:   # 30-min break due
                self._add(OFF, BREAK_LEN, note="30-min break")
                self.drive_since_break = 0.0
                continue
            if self.miles_since_fuel >= FUEL_EVERY - EPS:     # fuel due
                self.on_duty(FUEL_LEN, "En route", "Fuel stop")
                self.miles_since_fuel = 0.0
                continue
            # drive up to the next forced stop
            caps = [
                remaining,
                self.drive_left,
                window_left,
                BREAK_AFTER - self.drive_since_break,
                CYCLE_LIMIT - self.cycle_used,
            ]
            if speed > EPS:
                caps.append((FUEL_EVERY - self.miles_since_fuel) / speed)
            dh = min(caps)
            self._add(DRIVING, dh, miles=dh * speed)
            self.drive_left -= dh
            self.drive_since_break += dh
            self.cycle_used += dh
            self.miles_since_fuel += dh * speed
            remaining -= dh


def _merge(segs):
    """Coalesce adjacent same-status segments so the timeline stays tidy."""
    out = []
    for s in segs:
        if out and out[-1]["status"] == s["status"] and out[-1]["end"] == s["start"]:
            out[-1]["end"] = s["end"]
            out[-1]["miles"] += s["miles"]
        else:
            out.append(dict(s))
    return out


def _split_at_midnight(seg):
    """Cut a segment that crosses midnight into one piece per calendar day."""
    parts = []
    start, end, total = seg["start"], seg["end"], (seg["end"] - seg["start"]).total_seconds()
    while start < end:
        next_midnight = datetime.combine(start.date() + timedelta(days=1), time.min)
        cut = min(end, next_midnight)
        frac = (cut - start).total_seconds() / total if total else 1.0
        parts.append({"status": seg["status"], "start": start, "end": cut, "miles": seg["miles"] * frac})
        start = cut
    return parts


def _assemble(sim, start_dt, end_dt):
    segs = list(sim.segments)
    # pad off-duty before the first shift and after the last so every log shows a full 24 hrs
    midnight = datetime.combine(start_dt.date(), time.min)
    if start_dt > midnight:
        segs.insert(0, {"status": OFF, "start": midnight, "end": start_dt, "miles": 0.0})
    last_midnight = datetime.combine(end_dt.date() + timedelta(days=1), time.min)
    if end_dt < last_midnight:
        segs.append({"status": OFF, "start": end_dt, "end": last_midnight, "miles": 0.0})

    segs = _merge(segs)
    by_day = {}
    for s in segs:
        for part in _split_at_midnight(s):
            by_day.setdefault(part["start"].date(), []).append(part)

    remarks_by_day = {}
    for r in sim.remarks:
        remarks_by_day.setdefault(r["time"].date(), []).append(r)

    # day on which each 34-hr restart finishes -> the cycle is fresh from there
    restart_done = {
        (r["time"] + timedelta(hours=CYCLE_RESTART)).date()
        for r in sim.remarks
        if "restart" in r["note"].lower()
    }

    logs = []
    for day in sorted(by_day):
        totals = {"off": 0.0, "sleeper": 0.0, "driving": 0.0, "onduty": 0.0}
        miles = 0.0
        segments = []
        for s in by_day[day]:
            hours = (s["end"] - s["start"]).total_seconds() / 3600
            totals[_TOTAL_KEY[s["status"]]] += hours
            miles += s["miles"]
            segments.append({"status": s["status"], "start": s["start"].isoformat(), "end": s["end"].isoformat()})
        logs.append({
            "date": day.isoformat(),
            "total_miles": round(miles, 1),
            "segments": segments,
            "remarks": [
                {"time": r["time"].isoformat(), "location": r["location"], "note": r["note"]}
                for r in remarks_by_day.get(day, [])
            ],
            "totals": {k: round(v, 2) for k, v in totals.items()},
            "restart": day in restart_done,
        })
    return logs


def build_logs(legs, cycle_used_hrs=0.0, start_dt=None, start_label="Start", start_note="Trip start"):
    """Simulate the trip and return list[DayLog-dict] (one per calendar day)."""
    if start_dt is None:
        start_dt = datetime.combine(date.today(), time(hour=8))

    sim = _Sim(cycle_used_hrs, start_dt)
    sim.remark(start_label, start_note)
    for leg in legs:
        sim.drive(leg["miles"], leg["hours"])
        arrive = leg["arrive"]
        sim.on_duty(arrive["duration"], arrive["label"], arrive["event"])
    return _assemble(sim, start_dt, sim.clock)
