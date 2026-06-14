import { useEffect, useRef } from "react"
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

const STOP_COLORS = {
  start: "#16a34a",
  pickup: "#f59e0b",
  dropoff: "#ef4444",
  fuel: "#3b82f6",
  rest: "#6366f1",
  sleeper: "#8b5cf6",
}

function pin(color) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.45)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

const TRUCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>`

const truckIcon = L.divIcon({
  className: "",
  html: `<div style="display:grid;place-items:center;width:28px;height:28px;border-radius:9999px;background:#f59e0b;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4)"><span class="truck-rot" style="display:flex;transition:transform .15s ease">${TRUCK_SVG}</span></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

// A truck marker that drives along the route polyline, looping.
function MovingTruck({ positions }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!positions || positions.length < 2) return

    // downsample long polylines so the per-frame walk stays cheap
    let pts = positions
    if (pts.length > 300) {
      const step = Math.ceil(pts.length / 300)
      pts = positions.filter((_, i) => i % step === 0)
      pts.push(positions[positions.length - 1])
    }

    const segs = []
    let total = 0
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]]
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      segs.push({ a, b, len, acc: total })
      total += len
    }
    if (total === 0) return

    const DURATION = 9000 // ms for one full pass
    let raf
    let startTs

    const tick = (ts) => {
      if (startTs == null) startTs = ts
      const progress = ((ts - startTs) % DURATION) / DURATION
      const dist = progress * total

      let seg = segs[segs.length - 1]
      for (const s of segs) {
        if (dist <= s.acc + s.len) {
          seg = s
          break
        }
      }
      const f = seg.len ? (dist - seg.acc) / seg.len : 0
      const lat = seg.a[0] + (seg.b[0] - seg.a[0]) * f
      const lon = seg.a[1] + (seg.b[1] - seg.a[1]) * f

      const marker = ref.current
      if (marker) {
        marker.setLatLng([lat, lon])
        const rot = marker.getElement?.()?.querySelector(".truck-rot")
        if (rot) rot.style.transform = seg.b[1] < seg.a[1] ? "scaleX(-1)" : "none"
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [positions])

  return <Marker ref={ref} position={positions[0]} icon={truckIcon} interactive={false} zIndexOffset={1000} />
}

function FitBounds({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions?.length > 1) {
      map.fitBounds(positions, { padding: [40, 40] })
    }
  }, [positions, map])
  return null
}

export default function RouteMap({ route, stops }) {
  const polyline = route?.polyline ?? []
  const center = polyline[0] ?? [39.5, -98.35] // US center fallback
  const bounds = polyline.length > 1 ? polyline : stops?.map((s) => [s.lat, s.lon])

  return (
    <div className="h-[440px] w-full overflow-hidden rounded-xl border">
      <MapContainer center={center} zoom={5} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {polyline.length > 1 && (
          <Polyline positions={polyline} pathOptions={{ color: "#f59e0b", weight: 5, opacity: 0.9 }} />
        )}
        {polyline.length > 1 && <MovingTruck positions={polyline} />}
        {stops?.map((s, i) => (
          <Marker key={i} position={[s.lat, s.lon]} icon={pin(STOP_COLORS[s.type] || "#64748b")}>
            <Popup>
              <span className="font-semibold capitalize">{s.type}</span>
              <br />
              {s.label}
            </Popup>
          </Marker>
        ))}
        <FitBounds positions={bounds} />
      </MapContainer>
    </div>
  )
}
