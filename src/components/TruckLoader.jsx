import { motion } from "motion/react"
import { Truck } from "lucide-react"

export default function TruckLoader({ label = "Planning your route…" }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <div className="relative w-60 h-10 overflow-hidden">
        {/* road */}
        <div className="absolute bottom-1.5 left-0 right-0 border-b-2 border-dashed border-muted-foreground/40" />
        {/* truck */}
        <motion.div
          className="absolute bottom-1.5 text-primary"
          initial={{ x: -44 }}
          animate={{ x: 248 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
        >
          <Truck className="h-8 w-8" />
        </motion.div>
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
