from __future__ import annotations

import logging
from typing import Any

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

GITHUB_API = 'https://api.github.com'


class GitHubAPIError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class GitHubClient:
    def __init__(self, access_token: str):
        self.access_token = access_token

    def _headers(self) -> dict[str, str]:
        return {
            'Authorization': f'Bearer {self.access_token}',
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        }

    def _request(self, method: str, path: str, **kwargs) -> Any:
        url = path if path.startswith('http') else f'{GITHUB_API}{path}'
        response = requests.request(
            method,
            url,
            headers=self._headers(),
            timeout=30,
            **kwargs,
        )
        if response.status_code >= 400:
            detail = response.text[:500]
            raise GitHubAPIError(
                f'GitHub API {method} {path} failed ({response.status_code}): {detail}',
                status_code=response.status_code,
            )
        if response.status_code == 204:
            return None
        return response.json()

    def list_repos(self, page: int = 1, per_page: int = 100) -> list[dict]:
        return self._request(
            'GET',
            '/user/repos',
            params={
                'sort': 'updated',
                'direction': 'desc',
                'per_page': per_page,
                'page': page,
            },
        )

    def get_repo(self, owner: str, repo: str) -> dict:
        return self._request('GET', f'/repos/{owner}/{repo}')

    def create_issue(
        self,
        owner: str,
        repo: str,
        *,
        title: str,
        body: str,
        labels: list[str] | None = None,
    ) -> dict:
        payload: dict[str, Any] = {'title': title, 'body': body}
        if labels:
            payload['labels'] = labels
        return self._request('POST', f'/repos/{owner}/{repo}/issues', json=payload)

    def get_issue(self, owner: str, repo: str, issue_number: int) -> dict:
        return self._request('GET', f'/repos/{owner}/{repo}/issues/{issue_number}')

    def update_issue(
        self,
        owner: str,
        repo: str,
        issue_number: int,
        *,
        title: str | None = None,
        body: str | None = None,
        state: str | None = None,
    ) -> dict:
        payload: dict[str, Any] = {}
        if title is not None:
            payload['title'] = title
        if body is not None:
            payload['body'] = body
        if state is not None:
            payload['state'] = state
        if not payload:
            raise GitHubAPIError('update_issue requires at least one field')
        return self._request(
            'PATCH',
            f'/repos/{owner}/{repo}/issues/{issue_number}',
            json=payload,
        )

    def update_issue_state(self, owner: str, repo: str, issue_number: int, state: str) -> dict:
        return self.update_issue(owner, repo, issue_number, state=state)

    def list_repo_hooks(self, owner: str, repo: str) -> list[dict]:
        return self._request('GET', f'/repos/{owner}/{repo}/hooks')

    def create_repo_hook(self, owner: str, repo: str, *, callback_url: str, secret: str) -> dict:
        return self._request(
            'POST',
            f'/repos/{owner}/{repo}/hooks',
            json={
                'name': 'web',
                'active': True,
                'events': ['issues'],
                'config': {
                    'url': callback_url,
                    'content_type': 'json',
                    'insecure_ssl': '0',
                    'secret': secret,
                },
            },
        )
