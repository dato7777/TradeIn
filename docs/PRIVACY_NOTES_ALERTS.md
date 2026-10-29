# Privacy notes — price alerts

`/privacy` is still the generic placeholder page, so this draft is for Phase 6. Do not publish it as legal advice.

`TODO(legal)` — have a lawyer review this paragraph before it goes on the site.

## Draft paragraph

If you ask for a price alert, we store the email address you typed, the phone you selected (model, storage, and condition), the language of the page, the version of the consent text you were shown (`alerts-v1`), a hash of the IP address used at sign-up, and the times you confirmed, were last emailed, and the subscription expires. We store the email so we can send the messages you asked for. We do not store the raw IP address. We do not create an account.

A pending request that is not confirmed is deleted after 48 hours. An active alert is deleted when you unsubscribe, or after 12 months without an alert email. Records of messages we tried to send are deleted after 90 days.

The email is sent by the email provider configured for the site (Resend, when production is set up). The site is hosted on Vercel. The database is Supabase. Cloudflare Turnstile runs on the form to block automated sign-ups. Turnstile may store its own cookie or local data on Cloudflare's domain; this site does not set a cookie of its own for alerts.

You can stop one alert, or every alert for that email, from the link in the footer of any alert email. You can also use the one-click unsubscribe control in your mail app.

## Consent

The text shown next to the form is the consent text. The version id `alerts-v1` and the confirmation time are stored when the visitor presses the confirm button in the email. Changing the consent sentence means bumping `CONSENT_TEXT_VERSION` in `frontend/lib/alertsCopy.ts`.

## TODO(copy)

Hebrew lines in the email that are not quoted in the phase prompt, and should be reviewed:

- disclaimer translation
- why you received the email
- the 12-month sentence
- "was" / "now"
- badge labels (price went up, price went down, offers available)
- the sentence used when there is no current price
