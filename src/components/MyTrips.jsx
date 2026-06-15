import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "motion/react"
import { toast } from "sonner"
import { ArrowLeft, Trash2, MapPin, Loader2 } from "lucide-react"
import { tripApi } from "@/api"
import TripResult from "@/components/TripResult"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const fmtWhen = (iso) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso))

function Detail({ id, onBack }) {
  const { data, isLoading } = useQuery({
    queryKey: ["trip", id],
    queryFn: () => tripApi.get(id).then((r) => r.data),
  })

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-8">
      <Button variant="ghost" size="sm" className="-ml-2 print:hidden" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back to trips
      </Button>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {data.current_location} → {data.dropoff_location}
            </h1>
            <p className="text-sm text-muted-foreground">
              via {data.pickup_location} · {fmtWhen(data.created_at)} · cycle used {data.cycle_used} hrs
            </p>
          </div>
          <TripResult key={data.id} result={data.result} tripId={data.id} cycleUsed={data.cycle_used} />
        </motion.div>
      )}
    </main>
  )
}

export default function MyTrips() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState(null)

  const { data: trips, isLoading } = useQuery({
    queryKey: ["trips"],
    queryFn: () => tripApi.list().then((r) => r.data),
  })

  const del = useMutation({
    mutationFn: (id) => tripApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips"] })
      toast.success("Trip deleted")
    },
    onError: () => toast.error("Could not delete trip"),
  })

  if (selected != null) return <Detail id={selected} onBack={() => setSelected(null)} />

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">My Trips</h1>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {trips?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <MapPin className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              No trips yet. Plan one from the Planner and it’ll show up here.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {trips?.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
          >
            <Card
              role="button"
              tabIndex={0}
              onClick={() => setSelected(t.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelected(t.id)}
              className="cursor-pointer transition-colors hover:border-primary/50"
            >
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {t.current_location} → {t.dropoff_location}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    via {t.pickup_location} · {fmtWhen(t.created_at)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
                    <span>{t.distance_miles} mi</span>
                    <span>{t.drive_hours} hrs</span>
                    <span>{t.days} day{t.days === 1 ? "" : "s"}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete trip"
                  disabled={del.isPending}
                  onClick={(e) => {
                    e.stopPropagation()
                    del.mutate(t.id)
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </main>
  )
}
