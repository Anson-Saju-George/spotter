
import { useMemo, useRef, useState } from "react"
import { motion } from "motion/react"
import { Pencil, Check, AlertTriangle, RotateCcw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

// FMCSA Record of Duty Status — DOT-style sheet with a draggable/tappable duty line.
const ROWS = ["OFF", "SLEEPER", "DRIVING", "ONDUTY"]
const ROW_LABEL = { OFF: "Off Duty", SLEEPER: "Sleeper", DRIVING: "Driving", ONDUTY: "On Duty" }
const TOTAL_KEY = { OFF: "off", SLEEPER: "sleeper", DRIVING: "driving", ONDUTY: "onduty" }

// geometry (SVG user units; the viewBox scales to the container width)
const PAD = 10
const LABEL_W = 86
const HOUR_W = 30
const GRID_W = HOUR_W * 24
const ROW_H = 34
const TOTALS_W = 58
const GRID_X = PAD + LABEL_W
const GRID_RIGHT = GRID_X + GRID_W
const TOTALS_RIGHT = GRID_RIGHT + TOTALS_W
const W = TOTALS_RIGHT + PAD
const TOP = 16
const GRID_TOP = TOP + 8
const GRID_BOTTOM = GRID_TOP + ROW_H * 4
const H = GRID_BOTTOM + 6
const TOTALS_MID = (GRID_RIGHT + TOTALS_RIGHT) / 2

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const snap = (h) => Math.round(h * 4) / 4 // 15-minute grid
const round2 = (x) => +x.toFixed(2)

const fmtDate = (d) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  }).format(new Date(d + "T00:00:00"))

const fmtTime = (iso) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

const hourLabel = (h) => (h % 12 === 0 ? "12" : String(h % 12))

// segments (ISO strings) <-> blocks (hours-from-midnight)
const fromSegments = (date, segments) => {
  const midnight = new Date(date + "T00:00:00").getTime()
  return segments.map((s) => ({
    status: s.status,
    start: (new Date(s.start).getTime() - midnight) / 3.6e6,
    end: (new Date(s.end).getTime() - midnight) / 3.6e6,
  }))
}

const pad2 = (n) => String(n).padStart(2, "0")
const localISO = (dt) =>
  `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}T${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:${pad2(dt.getSeconds())}`

const toSegments = (date, blocks) => {
  const midnight = new Date(date + "T00:00:00").getTime()
  return blocks.map((b) => ({
    status: b.status,
    start: localISO(new Date(midnight + b.start * 3.6e6)),
    end: localISO(new Date(midnight + b.end * 3.6e6)),
  }))
}

// keep blocks contiguous over 0..24 and merge neighbours with the same status
const normalize = (blocks) => {
  let out = blocks.filter((b) => b.end - b.start > 1e-6).map((b) => ({ ...b }))
  if (out.length === 0) return [{ status: "OFF", start: 0, end: 24 }]
  out.sort((a, b) => a.start - b.start)
  out[0].start = 0
  for (let i = 1; i < out.length; i++) out[i].start = out[i - 1].end
  out[out.length - 1].end = 24
  const merged = []
  for (const b of out) {
    const last = merged[merged.length - 1]
    if (last && last.status === b.status) last.end = b.end
    else merged.push({ ...b })
  }
  return merged
}

// lay a [t0,t1] block of `status` over the timeline, splitting whatever it overlaps
const carve = (blocks, t0, t1, status) => {
  t0 = clamp(t0, 0, 24)
  t1 = clamp(t1, 0, 24)
  if (t1 - t0 < 1e-6) return blocks
  const out = []
  for (const b of blocks) {
    if (b.start < t0) out.push({ status: b.status, start: b.start, end: Math.min(b.end, t0) })
    if (b.end > t1) out.push({ status: b.status, start: Math.max(b.start, t1), end: b.end })
  }
  out.push({ status, start: t0, end: t1 })
  return normalize(out)
}

function Field({ label, value }) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="block truncate font-medium">{value || "—"}</span>
    </div>
  )
}

export default function LogSheet({ day, index, total, editable = false, busy = false, onCommit, onDone, onReset, meta = {}, recap = null }) {
  const [blocks, setBlocks] = useState(() => fromSegments(day.date, day.segments))
  const [editing, setEditing] = useState(false)
  const [touched, setTouched] = useState(false)
  const [paint, setPaint] = useState(null) // live preview while painting a new block
  const svgRef = useRef(null)
  const drag = useRef(null)

  const X = (h) => GRID_X + h * HOUR_W
  const rowIndex = (status) => ROWS.indexOf(status)
  const rowCenter = (status) => GRID_TOP + rowIndex(status) * ROW_H + ROW_H / 2

  const totals = useMemo(() => {
    const t = { off: 0, sleeper: 0, driving: 0, onduty: 0 }
    blocks.forEach((b) => (t[TOTAL_KEY[b.status]] += b.end - b.start))
    return t
  }, [blocks])

  const warnings = useMemo(() => {
    const w = []
    if (totals.driving > 11.0001) w.push(`Driving ${round2(totals.driving)} h exceeds the 11-hr limit`)
    if (totals.driving + totals.onduty > 14.0001)
      w.push(`On-duty ${round2(totals.driving + totals.onduty)} h exceeds the 14-hr window`)
    let run = 0
    for (const b of blocks) {
      if (b.status === "DRIVING") run += b.end - b.start
      else if ((b.status === "OFF" || b.status === "SLEEPER") && b.end - b.start >= 0.5) run = 0
      if (run > 8.0001) {
        w.push("Over 8 hrs driving without a 30-min break")
        break
      }
    }
    return w
  }, [blocks, totals])

  // stepped duty line
  let path = ""
  blocks.forEach((b, i) => {
    const y = rowCenter(b.status)
    path += `${i === 0 ? "M" : " L"} ${X(b.start)} ${y} L ${X(b.end)} ${y}`
  })

  // --- pointer interactions ---
  const toUser = (e) => {
    const ctm = svgRef.current?.getScreenCTM()
    if (!ctm) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }
  const hoursAtX = (x) => clamp((x - GRID_X) / HOUR_W, 0, 24)
  const rowAtY = (y) => clamp(Math.floor((y - GRID_TOP) / ROW_H), 0, 3)

  const commit = (next) => {
    setBlocks(next)
    setTouched(true)
    onCommit?.(toSegments(day.date, next))
  }

  const toggleEdit = () => {
    if (editing) {
      setEditing(false)
      if (touched) {
        onDone?.(index, toSegments(day.date, normalize(blocks)))
        setTouched(false)
      }
    } else {
      setEditing(true)
    }
  }

  const cycleStatus = (i) => {
    commit(normalize(blocks.map((b, idx) => (idx === i ? { ...b, status: ROWS[(rowIndex(b.status) + 1) % 4] } : b))))
  }

  const startStatusDrag = (i, e) => {
    e.preventDefault()
    svgRef.current.setPointerCapture(e.pointerId)
    const u = toUser(e)
    drag.current = { type: "status", i, downX: u?.x ?? 0, downY: u?.y ?? 0, moved: false }
  }
  const startBoundaryDrag = (i, e) => {
    e.preventDefault()
    svgRef.current.setPointerCapture(e.pointerId)
    drag.current = { type: "boundary", i }
  }
  const startPaint = (e) => {
    e.preventDefault()
    svgRef.current.setPointerCapture(e.pointerId)
    const u = toUser(e)
    const row = rowAtY(u.y)
    const t0 = snap(hoursAtX(u.x))
    drag.current = { type: "paint", row, t0, t1: t0 }
    setPaint({ row, t0, t1: t0 })
  }

  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    const u = toUser(e)
    if (!u) return
    if (d.type === "boundary") {
      setBlocks((bs) => {
        const t = clamp(snap(hoursAtX(u.x)), bs[d.i].start, bs[d.i + 1].end)
        const next = bs.slice()
        next[d.i] = { ...next[d.i], end: t }
        next[d.i + 1] = { ...next[d.i + 1], start: t }
        return next
      })
    } else if (d.type === "status") {
      if (!d.moved && Math.abs(u.x - d.downX) + Math.abs(u.y - d.downY) > 3) d.moved = true
      if (d.moved) {
        const status = ROWS[rowAtY(u.y)]
        setBlocks((bs) => (bs[d.i].status === status ? bs : bs.map((b, i) => (i === d.i ? { ...b, status } : b))))
      }
    } else if (d.type === "paint") {
      d.t1 = snap(hoursAtX(u.x))
      setPaint({ row: d.row, t0: d.t0, t1: d.t1 })
    }
  }

  const onPointerUp = (e) => {
    const d = drag.current
    if (!d) return
    drag.current = null
    try {
      svgRef.current.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    if (d.type === "boundary") {
      commit(normalize(blocks))
    } else if (d.type === "status") {
      if (d.moved) commit(normalize(blocks))
      else cycleStatus(d.i)
    } else if (d.type === "paint") {
      setPaint(null)
      let a = Math.min(d.t0, d.t1)
      let b = Math.max(d.t0, d.t1)
      if (b - a < 0.25) {
        // a tap -> drop a default 30-min block of that row's status
        b = Math.min(24, a + 0.5)
        a = b - 0.5
      }
      commit(carve(blocks, a, b, ROWS[d.row]))
    }
  }

  const preview = (() => {
    if (!paint) return null
    let a = Math.min(paint.t0, paint.t1)
    let b = Math.max(paint.t0, paint.t1)
    if (b - a < 0.25) {
      b = Math.min(24, a + 0.5)
      a = b - 0.5
    }
    return { row: paint.row, a, b }
  })()

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className="print:break-inside-avoid"
    >
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Driver&apos;s Daily Log — Day {index + 1} of {total}
              </p>
              <p className="text-base font-semibold">{fmtDate(day.date)}</p>
            </div>
            <div className="flex items-center gap-2">
              {day.edited && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  Manually adjusted
                </span>
              )}
              {editable && day.edited && !editing && (
                <Button variant="ghost" size="sm" className="print:hidden" disabled={busy} onClick={() => onReset?.(index)}>
                  <RotateCcw className="h-4 w-4" /> Reset
                </Button>
              )}
              {editable && (
                <Button variant={editing ? "default" : "outline"} size="sm" className="print:hidden" disabled={busy} onClick={toggleEdit}>
                  {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  {editing ? "Done" : "Edit"}
                </Button>
              )}
            </div>
          </div>

          {/* DOT identity block */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border bg-muted/40 p-2.5 text-xs sm:grid-cols-3 lg:grid-cols-6">
            <Field label="From" value={meta.from} />
            <Field label="To" value={meta.to} />
            <Field label="Driver" value={meta.driver} />
            <Field label="Carrier" value={meta.carrier} />
            <Field label="Truck / Trailer" value={meta.truck} />
            <Field label="Total miles" value={day.total_miles} />
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full select-none"
            style={{ touchAction: "none" }}
            role="img"
            aria-label={`Duty status grid for ${day.date}`}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <g style={{ pointerEvents: "none" }}>
              {Array.from({ length: 25 }, (_, h) => (
                <text key={`hl${h}`} x={X(h)} y={TOP} textAnchor="middle" fontSize="8.5" fill="#475569" fontWeight={h % 6 === 0 ? 700 : 400}>
                  {hourLabel(h)}
                </text>
              ))}
              <text x={TOTALS_MID} y={TOP} textAnchor="middle" fontSize="8" fill="#475569">Hrs</text>

              {ROWS.map((_, ri) =>
                Array.from({ length: 24 }, (_, h) =>
                  [0.25, 0.5, 0.75].map((q, qi) => {
                    const top = GRID_TOP + ri * ROW_H
                    return (
                      <line key={`t${ri}-${h}-${qi}`} x1={X(h + q)} y1={top} x2={X(h + q)} y2={top + (q === 0.5 ? 7 : 4)} stroke="#cbd5e1" strokeWidth="0.5" />
                    )
                  })
                )
              )}

              {Array.from({ length: 25 }, (_, h) => (
                <line key={`v${h}`} x1={X(h)} y1={GRID_TOP} x2={X(h)} y2={GRID_BOTTOM} stroke={h % 6 === 0 ? "#94a3b8" : "#e2e8f0"} strokeWidth={h % 6 === 0 ? 1 : 0.6} />
              ))}

              {Array.from({ length: 5 }, (_, i) => (
                <line key={`hz${i}`} x1={GRID_X} y1={GRID_TOP + i * ROW_H} x2={GRID_RIGHT} y2={GRID_TOP + i * ROW_H} stroke={i === 0 || i === 4 ? "#475569" : "#cbd5e1"} strokeWidth={i === 0 || i === 4 ? 1 : 0.7} />
              ))}

              <rect x={GRID_X} y={GRID_TOP} width={GRID_W} height={ROW_H * 4} fill="none" stroke="#475569" strokeWidth="1" />
              <line x1={TOTALS_RIGHT} y1={GRID_TOP} x2={TOTALS_RIGHT} y2={GRID_BOTTOM} stroke="#475569" strokeWidth="1" />

              {ROWS.map((st) => (
                <g key={`r${st}`}>
                  <text x={GRID_X - 6} y={rowCenter(st) + 3} textAnchor="end" fontSize="9.5" fill="#334155">{ROW_LABEL[st]}</text>
                  <text x={TOTALS_MID} y={rowCenter(st) + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="#0f172a">{round2(totals[TOTAL_KEY[st]])}</text>
                </g>
              ))}
            </g>

            {editing && (
              <g>
                {/* paint surface: tap an empty row to drop a 30-min block, drag across to paint longer */}
                <rect x={GRID_X} y={GRID_TOP} width={GRID_W} height={ROW_H * 4} fill="transparent" style={{ cursor: "crosshair" }} onPointerDown={startPaint} />

                {/* the current line: tap to cycle, drag up/down to change status */}
                {blocks.map((b, i) => (
                  <rect
                    key={`seg${i}`}
                    x={X(b.start)}
                    y={GRID_TOP + rowIndex(b.status) * ROW_H + 1}
                    width={Math.max(0, X(b.end) - X(b.start))}
                    height={ROW_H - 2}
                    fill="#f59e0b"
                    fillOpacity="0.1"
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => startStatusDrag(i, e)}
                  />
                ))}

                {/* live paint preview */}
                {preview && (
                  <rect
                    x={X(preview.a)}
                    y={GRID_TOP + preview.row * ROW_H + 1}
                    width={Math.max(0, X(preview.b) - X(preview.a))}
                    height={ROW_H - 2}
                    fill="#f59e0b"
                    fillOpacity="0.4"
                    style={{ pointerEvents: "none" }}
                  />
                )}

                {/* boundary handles: drag to retime a status change */}
                {blocks.slice(0, -1).map((b, i) => (
                  <g key={`bnd${i}`}>
                    <line x1={X(b.end)} y1={GRID_TOP} x2={X(b.end)} y2={GRID_BOTTOM} stroke="#f59e0b" strokeWidth="1" style={{ pointerEvents: "none" }} />
                    <circle cx={X(b.end)} cy={rowCenter(b.status)} r="3.5" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" style={{ pointerEvents: "none" }} />
                    <rect x={X(b.end) - 6} y={GRID_TOP} width="12" height={ROW_H * 4} fill="transparent" style={{ cursor: "ew-resize" }} onPointerDown={(e) => startBoundaryDrag(i, e)} />
                  </g>
                ))}
              </g>
            )}

            <path d={path} fill="none" stroke="#1e293b" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" style={{ pointerEvents: "none" }} />
          </svg>

          {editing && (
            <p className="text-xs text-muted-foreground">
              Tap an empty row to add 30 min of that status, or drag across a row to paint longer. Tap the line to cycle it, drag it up/down, or drag the amber lines to retime.
            </p>
          )}

          {warnings.length > 0 && (
            <ul className="space-y-1">
              {warnings.map((w, i) => (
                <li key={i} className="flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {w}
                </li>
              ))}
            </ul>
          )}

          {recap && (
            <div className="rounded-md border p-2.5 text-xs">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium">70-hr / 8-day recap</span>
                <span className="text-muted-foreground">
                  On-duty today {recap.onDuty} h · {recap.available} h available next day
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
                <div className="h-full rounded bg-primary" style={{ width: `${Math.min(100, (recap.usedEnd / 70) * 100)}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">Cycle used: {recap.usedEnd} / 70 h</p>
            </div>
          )}

          {day.remarks?.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Remarks</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {day.remarks.map((r, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-xs">
                    <span className="font-medium tabular-nums">{fmtTime(r.time)}</span>
                    <span className="text-muted-foreground">
                      {r.note}
                      {r.location && r.location !== "En route" ? ` — ${r.location}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
