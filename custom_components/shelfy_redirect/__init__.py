"""Shelfy redirect integration.

Registers the stable route /shelfy/scan/container/{token} on Home Assistant's
own HTTP server and redirects it to the current Shelfy add-on ingress URL.

Why this exists:
  Raw HA ingress URLs contain a dynamic token that changes every time the
  add-on is reinstalled. QR codes on physical box labels would break after
  any reinstall. This integration provides a stable, permanent URL that is
  safe to print on labels and works through both local HA access and Nabu
  Casa remote access.

Configuration (configuration.yaml) — all fields optional:

  shelfy_redirect:
    addon_slug: shelfy   # default; change if HA prefixes it differently
"""
from __future__ import annotations

import logging
import os

import aiohttp
import aiohttp.web
import voluptuous as vol

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv

DOMAIN = "shelfy_redirect"
DEFAULT_ADDON_SLUG = "shelfy"
_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = vol.Schema(
    {
        DOMAIN: vol.Schema(
            {
                vol.Optional("addon_slug", default=DEFAULT_ADDON_SLUG): cv.string,
            }
        )
    },
    extra=vol.ALLOW_EXTRA,
)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the Shelfy redirect integration."""
    addon_slug = config.get(DOMAIN, {}).get("addon_slug", DEFAULT_ADDON_SLUG)
    hass.http.register_view(ShelfyRedirectView(addon_slug))
    _LOGGER.info("Shelfy redirect registered at /shelfy/scan/container/{token} (add-on slug: %s)", addon_slug)
    return True


class ShelfyRedirectView(HomeAssistantView):
    """Redirect /shelfy/scan/container/{token} to the Shelfy add-on ingress URL.

    requires_auth is False so the redirect happens before any auth challenge.
    Authentication occurs when the browser follows the redirect to the ingress
    URL — that is the normal HA ingress auth flow, which persists as a cookie
    after the first login.
    """

    url = "/shelfy/scan/container/{token}"
    name = "shelfy:scan_container"
    requires_auth = False

    def __init__(self, addon_slug: str) -> None:
        self._addon_slug = addon_slug

    async def get(self, request: aiohttp.web.Request, token: str) -> aiohttp.web.Response:
        """Resolve the current ingress URL and issue a redirect."""
        supervisor_token = os.environ.get("SUPERVISOR_TOKEN", "")
        if not supervisor_token:
            return aiohttp.web.Response(
                status=503,
                text=(
                    "Shelfy redirect: SUPERVISOR_TOKEN not available. "
                    "This integration requires Home Assistant OS or Supervised."
                ),
            )

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"http://supervisor/addons/{self._addon_slug}/info",
                    headers={"Authorization": f"Bearer {supervisor_token}"},
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as resp:
                    if resp.status != 200:
                        _LOGGER.error(
                            "Supervisor returned HTTP %s for add-on '%s'",
                            resp.status,
                            self._addon_slug,
                        )
                        return aiohttp.web.Response(
                            status=502,
                            text=(
                                f"Shelfy redirect: add-on '{self._addon_slug}' not found "
                                f"(Supervisor HTTP {resp.status}). "
                                "Check addon_slug in configuration.yaml."
                            ),
                        )
                    data = await resp.json()
        except Exception as err:
            _LOGGER.error("Shelfy redirect: could not reach Supervisor: %s", err)
            return aiohttp.web.Response(
                status=502,
                text="Shelfy redirect: could not reach Supervisor.",
            )

        ingress_url = data.get("data", {}).get("ingress_url")
        if not ingress_url:
            return aiohttp.web.Response(
                status=503,
                text=(
                    f"Shelfy redirect: add-on '{self._addon_slug}' has no ingress URL. "
                    "Is the add-on running?"
                ),
            )

        # ingress_url is e.g. "/api/hassio_ingress/<token>/"
        # Append the scan path and issue a relative redirect so the correct
        # host (local or Nabu Casa) is preserved by the browser.
        target = f"{ingress_url.rstrip('/')}/scan/container/{token}"
        raise aiohttp.web.HTTPFound(target)
