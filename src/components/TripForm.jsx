import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { MapPin, Truck, Flag, Clock } from "lucide-react"
import LocationInput from "@/components/LocationInput"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const location = z.object({
  label: z.string().min(2, "Required"),
  lat: z.number().nullable().optional(),
  lon: z.number().nullable().optional(),
})

// same place if both resolved to identical coords, else identical typed labels
const sameLoc = (a, b) => {
  if (a?.lat != null && b?.lat != null) return a.lat === b.lat && a.lon === b.lon
  const x = a?.label?.trim().toLowerCase()
  return !!x && x === b?.label?.trim().toLowerCase()
}

const schema = z
  .object({
    current: location,
    pickup: location,
    dropoff: location,
    cycle_used: z.coerce.number().min(0, "0 or more").max(70, "Max 70 hrs"),
  })
  .superRefine((val, ctx) => {
    if (sameLoc(val.pickup, val.dropoff)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dropoff", "label"],
        message: "Pickup and dropoff can't be the same",
      })
    }
  })

const emptyLoc = { label: "", lat: null, lon: null }

const locationFields = [
  { name: "current", label: "Current location", placeholder: "Chicago, IL", icon: MapPin },
  { name: "pickup", label: "Pickup location", placeholder: "Detroit, MI", icon: Truck },
  { name: "dropoff", label: "Dropoff location", placeholder: "Cleveland, OH", icon: Flag },
]

export default function TripForm({ onSubmit, isPending }) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { current: emptyLoc, pickup: emptyLoc, dropoff: emptyLoc, cycle_used: 0 },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan a trip</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
          {locationFields.map(({ name, label, placeholder, icon: Icon }) => (
            <div key={name} className="space-y-1.5">
              <Label htmlFor={name} className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                {label}
              </Label>
              <Controller
                name={name}
                control={control}
                render={({ field }) => (
                  <LocationInput
                    id={name}
                    placeholder={placeholder}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors[name]?.label && (
                <p className="text-xs text-destructive">{errors[name].label.message}</p>
              )}
            </div>
          ))}

          <div className="space-y-1.5">
            <Label htmlFor="cycle_used" className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Current cycle used (hrs)
            </Label>
            <Input
              id="cycle_used"
              type="number"
              step="0.5"
              min="0"
              max="70"
              placeholder="0"
              {...register("cycle_used")}
            />
            {errors.cycle_used && (
              <p className="text-xs text-destructive">{errors.cycle_used.message}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
              {isPending ? "Planning…" : "Plan trip"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
