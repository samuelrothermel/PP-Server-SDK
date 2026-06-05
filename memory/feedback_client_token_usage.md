---
name: feedback_client_token_usage
description: Which v6 SDK integrations require client token vs client ID auth
metadata:
  type: feedback
---

Client token (`/api/client-token`) is only required for Fastlane and ACH (`bank-ach-payments` component). All other JS SDK v6 integrations (PayPal, Venmo, cards, Google Pay, Apple Pay) use client ID auth only.

**Why:** Client token is a browser-safe token generated server-side from client ID + secret. ACH requires it per the limited-release docs; Fastlane requires it per its SDK requirements. Standard checkout methods do not.

**How to apply:** When adding a new v6 integration, default to client ID auth. Only reach for client token if the method is Fastlane or ACH.
