"""Trip model — stores each user's planned trip + the full computed result (for instant history)."""
from django.conf import settings
from django.db import models


class Trip(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="trips"
    )
    current_location = models.CharField(max_length=255)
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    cycle_used = models.FloatField(default=0.0)
    result = models.JSONField(default=dict)  # full TripOut payload
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.current_location} → {self.dropoff_location} ({self.user})"
