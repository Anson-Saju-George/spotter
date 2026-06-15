"""Single entry point: migrate + seed admin + serve. Run with `python app.py`.

Also importable as `app:application` by gunicorn/uvicorn:
    gunicorn app:application -k uvicorn.workers.UvicornWorker -b 0.0.0.0:$PORT
"""
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings")

import django

django.setup()

# 1) ensure DB schema exists on every boot (idempotent)
from django.core.management import call_command

call_command("migrate", interactive=False, verbosity=1)

# 2) admin allowlist -> superuser (idempotent). ADMIN_EMAILS is comma-separated.
from django.conf import settings as dj_settings
from django.contrib.auth import get_user_model

User = get_user_model()
# elevate any already-registered allowlisted users
User.objects.filter(username__in=dj_settings.ADMIN_EMAILS).update(
    is_staff=True, is_superuser=True
)
# bootstrap/sync EVERY allowlisted admin with ADMIN_PASSWORD (ready-to-use logins)
admin_pass = os.environ.get("ADMIN_PASSWORD")  # set in env; NEVER commit
if admin_pass:
    for email in dj_settings.ADMIN_EMAILS or ["ansonsaju2004@gmail.com"]:
        admin, created = User.objects.get_or_create(
            username=email, defaults={"email": email}
        )
        admin.is_staff = admin.is_superuser = True
        admin.set_password(admin_pass)  # always reflect the current env password
        admin.save()
        print(f"[app] admin {email} ready ({'created' if created else 'password synced'})")

# 3) the ASGI app
from django.core.asgi import get_asgi_application

application = get_asgi_application()

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(application, host="0.0.0.0", port=port)
