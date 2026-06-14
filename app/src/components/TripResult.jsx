import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Route as RouteIcon, Clock, MapPin, CalendarDays, Printer, Loader2 } from "lucide-react"
import { tripApi } from "@/api"
import { useAuth } from "@/auth"
import RouteMap from "@/components/RouteMap"
import LogSheet from "@/components/LogSheet"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const KEY = { OFF: "off", SLEEPER: "sleeper", DRIVING: "driving", ONDUTY: "onduty" }
const CYCLE_LIMIT = 70

function totalsFromSegments(segments) {
  const t = { off: 0, sleeper: 0, driving: 0, onduty: 0 }
  segments.forEach((s) => (t[KEY[s.status]] += (new Date(s.end) - new Date(s.start)) / 3.6e6))
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, +v.toFixed(2)]))
}

// cumulative 70-hr/8-day recap per day — cascades forward as days are edited
function computeRecaps(logs, cycleUsed) {
  let running = cycleUsed || 0
  return logs.map((d) => {
    if (d.restart) running = 0
    const usedStart = running
    const onDuty = (d.totals.driving || 0) + (d.totals.onduty || 0)
    const usedEnd = +(usedStart + onDuty).toFixed(2)
    running = usedEnd
    return { onDuty: +onDuty.toFixed(2), usedEnd, available: +Math.max(0, CYCLE_LIMIT - usedEnd).toFixed(2) }
  })
}

function Stat({ icon: Icon, label, value }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// Shared route + stats + editable ELD-log view. Editing a day re-simulates the days after it.
export default function TripResult({ result, tripId, cycleUsed = 0 }) {
  const id = tripId ?? result?.id
  const editable = id != null
  const { user } = useAuth()

  const [logs, setLogs] = useState(result.logs)
  const [resetKey, setResetKey] = useState(0)
  const qc = useQueryClient()

  // cascade: keep the first N days, re-simulate the rest (server is the source of truth)
  const cascade = useMutation({
    mutationFn: ({ logsPayload, keepThrough }) =>
      tripApi.cascade(id, logsPayload, keepThrough).then((r) => r.data),
    onSuccess: (detail) => {
      setLogs(detail.result.logs)
      setResetKey((k) => k + 1) // remount sheets so every day reflects the new plan
      qc.invalidateQueries({ queryKey: ["trips"] })
      qc.invalidateQueries({ queryKey: ["trip", id] })
    },
    onError: () => toast.error("Could not recompute the following days"),
  })

  if (!result) return null

  const recaps = computeRecaps(logs, cycleUsed)
  const meta = {
    driver: user?.email ?? "—",
    carrier: "Spotter Logistics",
    truck: "TRK-001 / TRL-114",
    from: result.stops?.[0]?.label ?? "",
    to: result.stops?.[result.stops.length - 1]?.label ?? "",
  }

  // live (un-saved) edit -> update the recap immediately
  const commitDay = (i, segments) => {
    setLogs((prev) =>
      prev.map((d, idx) => (idx === i ? { ...d, segments, totals: totalsFromSegments(segments), edited: true } : d))
    )
  }

  // finished editing day i -> persist it + re-simulate days after it
  const finalizeDay = (i, segments) => {
    const updated = logs.map((d, idx) =>
      idx === i ? { ...d, segments, totals: totalsFromSegments(segments), edited: true } : d
    )
    setLogs(updated)
    cascade.mutate({ logsPayload: updated, keepThrough: i + 1 })
  }

  // reset day i back to the ideal plan (and re-simulate from there)
  const resetDay = (i) => cascade.mutate({ logsPayload: logs, keepThrough: i })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:hidden">
        <Stat icon={RouteIcon} label="Distance" value={`${result.route.distance_miles} mi`} />
        <Stat icon={Clock} label="Drive time" value={`${result.route.drive_hours} hrs`} />
        <Stat icon={MapPin} label="Stops" value={result.stops.length} />
        <Stat icon={CalendarDays} label="Days" value={logs.length} />
      </div>

      <div className="print:hidden">
        <RouteMap route={result.route} stops={result.stops} />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            Daily logs <span className="text-sm font-normal text-muted-foreground">({logs.length})</span>
            {cascade.isPending && (
              <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> recomputing…
              </span>
            )}
          </h2>
          <Button variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>

        {logs.map((day, i) => (
          <LogSheet
            key={`${resetKey}-${day.date}`}
            day={day}
            index={i}
            total={logs.length}
            editable={editable}
            busy={cascade.isPending}
            meta={meta}
            recap={recaps[i]}
            onCommit={(segments) => commitDay(i, segments)}
            onDone={finalizeDay}
            onReset={resetDay}
          />
        ))}
      </div>
    </div>
  )
}
