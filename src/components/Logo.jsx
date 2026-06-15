import { motion } from "motion/react"
import { Truck } from "lucide-react"

export default function Logo({ size = "md" }) {
  const big = size === "lg"
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex items-center gap-2 select-none"
    >
      <span
        className={`grid place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm ${
          big ? "h-12 w-12" : "h-9 w-9"
        }`}
      >
        <Truck className={big ? "h-7 w-7" : "h-5 w-5"} />
      </span>
      <span className={`font-bold tracking-tight ${big ? "text-3xl" : "text-xl"}`}>
        Spotter
      </span>
    </motion.div>
  )
}
