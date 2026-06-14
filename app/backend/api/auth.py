"""Auth endpoints: register + me. Login/refresh come from ninja-jwt's controller (/api/token/*)."""
from django.conf import settings
from django.contrib.auth import get_user_model
from ninja import Router, Schema
from ninja_jwt.authentication import JWTAuth
from ninja_jwt.tokens import RefreshToken

router = Router()
User = get_user_model()


class RegisterIn(Schema):
    email: str
    password: str


class AuthOut(Schema):
    access: str
    refresh: str
    email: str
    is_admin: bool


class MeOut(Schema):
    email: str
    is_admin: bool


def _tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token), str(refresh)


@router.post("/register", response={201: AuthOut, 400: dict, 409: dict}, auth=None)
def register(request, data: RegisterIn):
    email = data.email.strip().lower()
    if not email or not data.password:
        return 400, {"detail": "Email and password are required."}
    if len(data.password) < 6:
        return 400, {"detail": "Password must be at least 6 characters."}
    if User.objects.filter(username=email).exists():
        return 409, {"detail": "An account with this email already exists."}

    is_admin = email in settings.ADMIN_EMAILS
    user = User.objects.create_user(username=email, email=email, password=data.password)
    if is_admin:
        user.is_staff = user.is_superuser = True
        user.save(update_fields=["is_staff", "is_superuser"])

    access, refresh = _tokens_for(user)
    # auto-login: hand back tokens so the user lands straight in the app
    return 201, {"access": access, "refresh": refresh, "email": email, "is_admin": is_admin}


@router.get("/me", response=MeOut, auth=JWTAuth())
def me(request):
    u = request.auth
    return {"email": u.username, "is_admin": u.is_superuser}
