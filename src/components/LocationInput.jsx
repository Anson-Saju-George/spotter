import { useEffect, useRef, useState } from "react"
import { Loader2, Check } from "lucide-react"
import api from "@/api"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// module-level cache so repeated prefixes resolve instantly (and persist across all 3 fields)
const SUGGEST_CACHE = new Map()

/**
 * Location typeahead. value/onChange use { label, lat, lon }.
 * A selection sets lat/lon (tracked); free typing clears them until re-selected.
 */
export default function LocationInput({ value, onChange, id, placeholder }) {
  const label = value?.label || ""
  const resolved = value?.lat != null && value?.lon != null

  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)
  const boxRef = useRef(null)

  // fetch suggestions while typing (debounced); skip once a location is resolved
  useEffect(() => {
    const text = label.trim()
    if (resolved || text.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    // instant from cache: no spinner, no network round-trip
    if (SUGGEST_CACHE.has(text)) {
      const data = SUGGEST_CACHE.get(text)
      setSuggestions(data)
      setOpen(data.length > 0)
      setActive(-1)
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/geocode/autocomplete", { params: { text } })
        SUGGEST_CACHE.set(text, data)
        setSuggestions(data)
        setOpen(data.length > 0)
        setActive(-1)
      } catch {
        setSuggestions([])
        setOpen(false)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [label, resolved])

  // close on outside click
  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  const pick = (s) => {
    onChange({ label: s.label, lat: s.lat, lon: s.lon })
    setOpen(false)
    setSuggestions([])
  }

  const onKeyDown = (e) => {
    if (!open || !suggestions.length) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, suggestions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault()
      pick(suggestions[active])
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <Input
        id={id}
        autoComplete="off"
        placeholder={placeholder}
        value={label}
        onChange={(e) => onChange({ label: e.target.value, lat: null, lon: null })}
        onFocus={() => suggestions.length && setOpen(true)}
        onKeyDown={onKeyDown}
        className={cn(resolved && "pr-9")}
      />
      {loading && (
        <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {!loading && resolved && (
        <Check className="absolute right-2.5 top-2.5 h-4 w-4 text-green-600" />
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-lg">
          {suggestions.map((s, i) => (
            <li
              key={`${s.label}-${i}`}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(s)
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm",
                i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
              )}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
