"""Signed URLs for authenticated media delivery."""

from urllib.parse import quote

from django.core.signing import BadSignature, SignatureExpired, TimestampSigner

MEDIA_SIGNATURE_MAX_AGE = 60 * 60 * 24  # 24 hours
_SIGNER = TimestampSigner(salt='protected-media')


def sign_media_path(file_name: str) -> str:
    return _SIGNER.sign(file_name)


def verify_media_signature(file_name: str, signature: str) -> None:
    from rest_framework.exceptions import PermissionDenied

    try:
        unsigned = _SIGNER.unsign(signature, max_age=MEDIA_SIGNATURE_MAX_AGE)
    except (BadSignature, SignatureExpired) as exc:
        raise PermissionDenied('Invalid or expired media link.') from exc

    if unsigned != file_name:
        raise PermissionDenied('Invalid media link.')


def _encoded_media_path(file_name: str) -> str:
    return '/'.join(quote(part, safe='') for part in file_name.split('/'))


def build_protected_media_url(request, file_name: str | None) -> str | None:
    if not file_name or not request:
        return None

    try:
        signature = sign_media_path(file_name)
        relative_url = f'/api/media/{_encoded_media_path(file_name)}'
        return request.build_absolute_uri(f'{relative_url}?sig={signature}')
    except Exception:
        relative_url = f'/api/media/{_encoded_media_path(file_name)}'
        return request.build_absolute_uri(relative_url)
