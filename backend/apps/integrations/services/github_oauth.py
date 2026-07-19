from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from urllib.parse import urlencode

import requests
from django.conf import settings


GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
GITHUB_USER_URL = 'https://api.github.com/user'


def github_oauth_configured() -> bool:
    return bool(settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET)


def _sign_payload(payload: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256,
    ).hexdigest()


def make_oauth_state(tenant_slug: str, user_id: int) -> str:
    nonce = secrets.token_urlsafe(16)
    payload = f'{tenant_slug}:{user_id}:{nonce}'
    signed = f'{payload}:{_sign_payload(payload)}'
    return base64.urlsafe_b64encode(signed.encode('utf-8')).decode('utf-8')


def parse_oauth_state(state: str) -> tuple[str, int]:
    try:
        decoded = base64.urlsafe_b64decode(state.encode('utf-8')).decode('utf-8')
        tenant_slug, user_id, nonce, signature = decoded.rsplit(':', 3)
        payload = f'{tenant_slug}:{user_id}:{nonce}'
        if not hmac.compare_digest(_sign_payload(payload), signature):
            raise ValueError('Invalid OAuth state signature')
        return tenant_slug, int(user_id)
    except (ValueError, TypeError) as exc:
        raise ValueError('Invalid OAuth state') from exc


def build_authorize_url(tenant_slug: str, user_id: int) -> str:
    params = {
        'client_id': settings.GITHUB_CLIENT_ID,
        'redirect_uri': settings.GITHUB_OAUTH_REDIRECT_URI,
        'scope': settings.GITHUB_OAUTH_SCOPES,
        'state': make_oauth_state(tenant_slug, user_id),
    }
    return f'{GITHUB_AUTHORIZE_URL}?{urlencode(params)}'


def exchange_code_for_token(code: str) -> dict:
    response = requests.post(
        GITHUB_TOKEN_URL,
        headers={'Accept': 'application/json'},
        data={
            'client_id': settings.GITHUB_CLIENT_ID,
            'client_secret': settings.GITHUB_CLIENT_SECRET,
            'code': code,
            'redirect_uri': settings.GITHUB_OAUTH_REDIRECT_URI,
        },
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get('error'):
        raise ValueError(payload.get('error_description') or payload['error'])
    return payload


def fetch_github_user(access_token: str) -> dict:
    response = requests.get(
        GITHUB_USER_URL,
        headers={
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()
