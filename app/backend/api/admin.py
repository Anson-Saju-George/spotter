"""Register Trip in Django admin so the superuser has full access at /admin."""
from django.contrib import admin

from .models import Trip


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = (
        "id", "user", "current_location", "pickup_location",
        "dropoff_location", "cycle_used", "created_at",
    )
    list_filter = ("created_at", "user")
    search_fields = ("current_location", "pickup_location", "dropoff_location")
    readonly_fields = ("created_at",)
