---
name: feedback_client_token_usage
description: Which v6 SDK integrations require client token vs client ID auth
metadata:
  type: feedback
---

Client token auth is only required for Fastlane and ACH (`bank-ach-payments` component). All other JS SDK v6 integrations (PayPal, Venmo, cards, Google Pay, Apple Pay) use client ID auth only.

**Two different token types — do not share endpoints:**
- **Fastlane** uses `/api/client-token` → `POST v1/identity/generate-token` → returns an opaque `client_token`
- **ACH SDK v6** uses `/api/ach/client-token` → `POST v1/oauth2/token` with `response_type=client_token` → returns a JWT (`access_token` field). The ACH SDK explicitly validates that the token is a JWT and rejects the opaque token with `SdkInitError: clientToken must be a valid JSON Web Token`.

**How to apply:** When adding a new v6 integration, default to client ID auth. If it's Fastlane use `/api/client-token`. If it's ACH use `/api/ach/client-token`.
