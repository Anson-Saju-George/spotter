import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { motion } from "motion/react"
import { tripApi } from "@/api"
import TripForm from "@/components/TripForm"
import TripResult from "@/components/TripResult"
import TruckLoader from "@/components/TruckLoader"
import TruckArt from "@/components/TruckArt"

export default function Planner() {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (values) => tripApi.plan(values).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trips"] }), // refresh saved history
    onError: (e) => toast.error(e.response?.data?.detail || "Could not plan trip"),
  })
  const result = mutation.data

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="print:hidden">
        <TripForm onSubmit={(values) => mutation.mutate(values)} isPending={mutation.isPending} />
      </div>

      {mutation.isPending && <TruckLoader />}

      {result && !mutation.isPending && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <TripResult key={result.id} result={result} tripId={result.id} cycleUsed={result.cycle_used} />
        </motion.div>
      )}

      {!result && !mutation.isPending && (
        <div className="flex flex-col items-center gap-4 py-14 text-center text-muted-foreground">
          <TruckArt className="h-28 w-auto opacity-95" />
          <p className="max-w-xs text-sm">
            Enter your trip details above to map the route and auto-draw your daily ELD logs.
          </p>
        </div>
      )}
    </main>
  )
}
