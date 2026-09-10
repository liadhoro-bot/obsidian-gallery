# Grow + Make setup for Obsidian Gallery's payment pass

This is the piece that has to be built by hand in Make's and Grow's own
dashboards — I can't create Make scenarios or change Grow account settings
for you from here. Everything on the app side (the code) is already done;
this doc is the checklist to make it real.

## How the whole thing fits together

```
Login (magic link / Google)
        |
        v
/auth/callback  ->  proxy.ts (middleware)
        |                 |
        |          not paid & gate is on
        |                 v
        |            /subscribe  (new page)
        |                 |
        |     fills name + phone, clicks "Pay"
        |                 v
        |     POST /api/subscription/create-payment
        |                 |
        |                 v
        |     Make Scenario 1: "Create Payment Link" (on demand)
        |                 |
        |         returns { paymentUrl } to the app
        |                 v
        |     window.open(paymentUrl)  <-- Grow's hosted payment page
        |                 |
        |          user pays on Grow's page
        |            /            \
        |           v              v
        | Grow redirects popup   Grow calls the Notify URL
        | to /payment-success    (server to server, independent
        | -> postMessage +       of whether the popup is even
        |    window.close()      still open)
        |           |                    |
        |           v                    v
        |   /subscribe polls      Make Scenario 2: receives the
        |   /api/subscription/    notification, calls "Approve
        |   status until paid     Transaction", then writes/updates
        |           |             a row in Supabase `subscriptions`
        |           v                    |
        +----> /dashboard  <-------------+
```

The popup and the webhook are two independent paths to the same result
(a row in `subscriptions` with `paid_until` in the future). The popup path
is just for a fast, responsive UI — the webhook path is the one that's
actually authoritative and will still work even if the user closes the
popup, their browser blocks it, or JavaScript on the success page fails.

## 0. Prerequisites already in place

- `supabase/migrations/20260909120000_add_grow_subscriptions.sql` — creates
  the `subscriptions` table. Run it with `npx supabase db push` (or however
  you normally apply migrations to this project) before testing.
- `SUPABASE_SERVICE_ROLE_KEY` — already in your `.env.local` and (presumably)
  in Vercel's env vars, since `dashboard-entry-guard.ts` already uses it.
- New env vars added to `.env.local` (values still need filling in — see
  step 4 below): `SUBSCRIPTION_REQUIRED`, `SUBSCRIPTION_BYPASS_EMAILS`,
  `MAKE_CREATE_PAYMENT_WEBHOOK_URL`, `MAKE_WEBHOOK_SHARED_SECRET`. Add the
  same four to Vercel's project settings (Settings > Environment Variables)
  before deploying, or `create-payment` will fail in production.

## 1. Decide the actual plan terms

Before wiring anything, pin these down — the scenario below uses
placeholders for them:

- **Price**: you tested with 20 NIS. Is that the real price?
- **Duration**: how long does one payment cover? (e.g. "30 days" — a fixed
  pass — vs. a true recurring monthly charge that Grow re-bills
  automatically). This matters because it changes both the Grow "Payment
  Type" field (`payments` vs `recurring payment`) and how Scenario 2
  computes `paid_until`.

The rest of this doc assumes: **one payment = a 30-day pass**, using
Grow's "payments" type with a single installment. If you actually want
Grow to auto-rebill, tell me and I'll adjust the guidance (the Notify
webhook fires on every rebill too, so Scenario 2 barely changes — you'd
just also want a way to detect/handle cancellations, which Make can't do
for recurring plans per Grow's own docs).

## 2. Scenario 1 — "OG · Create Payment Link (on demand)"

This replaces the manual test scenario you already built ("Integration
Grow" in your screenshot). You can either edit that one or duplicate it —
duplicating is safer so you keep the working manual test around.

1. **Trigger**: add a **Webhooks > Custom webhook** module (this is Make's
   own webhook trigger, not a Grow module). Create a new webhook, name it
   something like `og-create-payment`. Make will give you a URL like
   `https://hook.eu2.make.com/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` — copy it,
   it goes into `MAKE_CREATE_PAYMENT_WEBHOOK_URL` in step 4.
   - Click "Redetermine data structure" and send one test request from
     your app (or just from a REST client / curl) with a body like
     `{"email":"you@example.com","fullName":"Ada Lovelace","firstName":"Ada","lastName":"Lovelace","phone":"0501234567"}`
     so Make learns the JSON shape.
   - Optional hardening: add a **Filter** right after the trigger that
     checks the incoming header `x-webhook-secret` equals the value you'll
     put in `MAKE_WEBHOOK_SHARED_SECRET`. (Make exposes headers on the
     webhook module's output once you enable that in the webhook's
     advanced settings — look for a `headers` field in the trigger's output
     bundle after your test request.)

2. **Grow module: Create Payment Link.** Map fields from the trigger:
   - Sending Mode: **none** (important — we don't want Grow to also SMS or
     email the customer separately; the app shows the link directly in the
     popup).
   - Full Name: check whether Grow's module wants one combined field or
     separate first/last name fields — the app already sends both shapes
     (`fullName` and `firstName`/`lastName`), so map whichever the module
     asks for.
   - Phone: `{{phone}}`
   - Charge Type: regular charge
   - Title: `Obsidian Gallery Pass` (or whatever you want the customer to see)
   - Payment Type: `payments`, count `1`
   - Products: one item — Product Name `Obsidian Gallery Pass — 30 days`,
     Price `20` (or your real price), Quantity `1`, VAT Type per how your
     business is registered.
   - Notify URL: the webhook URL from **Scenario 2** (step 3 below — you'll
     need to build that scenario first, or come back and fill this in
     after).
   - Success URL: `https://<your-production-domain>/payment-success`
     (must be HTTPS and not localhost, per Grow's docs — use your real
     Vercel domain, e.g. `https://obsidian-gallery-v3.vercel.app/payment-success`,
     or your custom domain if you have one).

3. **Webhook response module.** Add **Webhooks > Webhook response**, body:
   ```json
   { "paymentUrl": "{{the Create Payment Link module's URL output field}}" }
   ```
   Run a test to see the exact field name Grow's module outputs (something
   like "Payment Page URL" — Make will show you the real field name/token
   once you've run it once), then map that into `paymentUrl`. This is the
   field `app/api/subscription/create-payment/route.ts` reads.

4. Turn the scenario **on** (scheduling: "Immediately as data arrives", since
   it's webhook-triggered).

## 3. Scenario 2 — "OG · Grow Payment Notify"

This is a new, separate scenario. It runs whenever Grow reports a payment
event — independent of the popup, which is what makes it reliable.

1. **Trigger**: Grow's own **Notify URL Webhook** module. Add it, and Make
   will give you a URL — that's what you map into the Create Payment Link
   module's **Notify URL** field in Scenario 1 (go back and fill that in
   now if you skipped it).

2. **Approve Transaction.** Per Grow's docs, you must call this after
   receiving the notification, or Grow will keep retrying (roughly every
   10, 20, 30 minutes). Map whatever transaction/reference ID field the
   Notify trigger gives you — **run a real test payment first (sandbox is
   fine) and look at the actual bundle Make received**, since the exact
   field name isn't documented on the page I read; it'll be obvious once
   you see a real payload (something like a transaction ID / "asmachta"
   field).

3. **Filter (optional but recommended):** only continue if the transaction
   status in the payload means "paid successfully" — you'll see the exact
   field/value once you've run a real test.

4. **Compute the new `paid_until`.** Add a **Tools > Set variable** module
   (or use inline functions in the next step) to compute:
   ```
   paidUntil = formatDate(addDays(now; 30); "YYYY-MM-DD'T'HH:mm:ssZ")
   ```
   Replace `30` with your real plan duration from step 1. If you want
   stacking (someone paying again before their pass expires extends from
   their *current* expiry rather than from today), you'd instead read the
   existing row first (an HTTP GET to Supabase, see below) and add days to
   whichever of `paid_until` or `now` is later — ask me to add that logic
   if you want it; the MVP version just always extends 30 days from now.

5. **Write to Supabase — HTTP module (Tools/HTTP > Make a request).**
   This talks to Supabase's REST API directly, which is the most reliable
   way to get a true upsert-by-email:
   - Method: `POST`
   - URL: `https://ckzrvjisesooqcmmtvwl.supabase.co/rest/v1/subscriptions?on_conflict=email`
   - Headers:
     - `apikey`: your Supabase **service role** key (same value as
       `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` — treat it as a secret,
       don't paste it anywhere public)
     - `Authorization`: `Bearer <same service role key>`
     - `Content-Type`: `application/json`
     - `Prefer`: `resolution=merge-duplicates,return=representation`
   - Body (raw JSON):
     ```json
     {
       "email": "{{email from the notify payload}}",
       "phone": "{{phone from the notify payload}}",
       "full_name": "{{name from the notify payload}}",
       "plan_name": "obsidian-gallery-pass-30d",
       "amount": 20,
       "currency": "ILS",
       "grow_transaction_id": "{{transaction id from the notify payload}}",
       "status": "active",
       "paid_until": "{{paidUntil from step 4}}",
       "last_payment_at": "{{formatDate(now; \"YYYY-MM-DD'T'HH:mm:ssZ\")}}"
     }
     ```
   The email must be the *same* address the customer used to sign in to
   Obsidian Gallery, lowercase or not (the database normalizes it either
   way) — this only works cleanly if the email you collect on `/subscribe`
   (which is always their logged-in Supabase email, not something they
   retype) is what actually reaches Grow, which it is: `create-payment`
   sends `user.email` straight through.

6. Turn this scenario **on** too.

## 4. Fill in the app's env vars and turn testing on

In `.env.local` (already appended with placeholders) and in Vercel's
project settings, set:

- `MAKE_CREATE_PAYMENT_WEBHOOK_URL` = the URL from Scenario 1's trigger
- `MAKE_WEBHOOK_SHARED_SECRET` = a random string (only needed if you added
  the optional Filter in Scenario 1 step 1)
- `SUBSCRIPTION_REQUIRED` = leave as `false` for now
- `SUBSCRIPTION_BYPASS_EMAILS` = your own email(s), comma-separated

With the gate off, nothing changes for anyone yet — you can hit
`/subscribe` directly to test the whole flow without it affecting real
users.

## 5. Test end to end (use Grow's Sandbox environment first)

1. Deploy (or run locally with `npm run dev`), sign in, then visit
   `/subscribe?next=/dashboard` directly.
2. Fill in name + phone, click "Pay & unlock the app". A popup should open
   showing Grow's hosted payment page.
3. Pay with a sandbox test card / sandbox flow. Grow should redirect the
   popup to `/payment-success`, which closes itself and sends you to
   `/dashboard`.
4. Separately, check in Supabase (Table Editor > `subscriptions`) that a
   row exists for your email with a `paid_until` about 30 days out, and
   check Make's scenario history for Scenario 2 shows a successful run.
5. Only once that all works with real (or sandbox) Grow traffic, flip
   `SUBSCRIPTION_REQUIRED=true` in Vercel and redeploy — that's the switch
   that actually requires payment for everyone hitting the app.

## 6. Notes / things to double check before launch

- Grow's Make module can't cancel a recurring plan (per their docs) — if
  you go with true recurring billing rather than a fixed-duration pass,
  cancellations need to be handled in Grow's own dashboard, not Make.
- The existing `/onboarding` flow (goal + first unit) still runs *before*
  the payment gate. If you'd rather charge before onboarding, that's a
  one-line reorder in `proxy.ts` — say so and I'll flip it.
- `/subscribe` currently always charges the same fixed plan. If you later
  want multiple passes/prices, that page and the create-payment route both
  need a plan selector — ping me when you're ready for that.
