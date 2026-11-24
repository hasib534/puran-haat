# Puran Haat Cloud Functions

Admin-only callables that reach Firebase **Auth**, which the Firestore rules
cannot touch:

| Callable | What it does |
| --- | --- |
| `setAccountDisabled({ uid, disabled })` | Disables or re-enables the Auth account and revokes its refresh tokens, then mirrors `account_disabled` / `account_disabled_at` / `account_disabled_by` onto `users/{uid}`. |
| `deleteAccount({ uid })` | Deletes the Auth account and the profile document. Listings, proposals and reviews are kept as trade history. |

Both require the caller to be a signed-in user with an `admins/{uid}` document —
the same allow-list the admin portal already relies on.

## Why this exists

The Firestore rules stop a suspended or banned trader from posting, chatting or
trading, because every write reads `moderation_status` / `suspended_until` back
off their profile. What the rules cannot do is stop the person from *signing in*
and reading the app, and a Firebase Auth account is only reachable through the
Admin SDK. Disabling the account is the real "this person can no longer use the
app" switch.

## Requirements

Cloud Functions need the **Blaze (pay-as-you-go)** plan. On the free Spark plan
`firebase deploy --only functions` fails with:

```
Error: Your project must be on the Blaze (pay-as-you-go) plan ...
```

Upgrade in the Firebase console under **Usage and billing**, then set a budget
alert. Two callables that run only when an admin presses a button cost
effectively nothing.

## Deploy

```bash
# from the repository root
cd functions
npm install
npm run build            # tsc -> functions/lib
cd ..
firebase deploy --only functions
```

`firebase.json` already points at this folder and builds it before deploying.

The functions default to the `us-central1` region. The portal calls the same
default, so no configuration is needed; if you move them, set
`VITE_FUNCTIONS_REGION` in `admin-web/.env.local` to match.

`functions/lib/` is the compiled output. It is not checked in — add
`functions/lib/` to `.gitignore` if your clone does not already ignore it.

## Wiring it into the portal

The portal ships the client for these callables but hides the buttons unless you
opt in, so the existing moderation flow keeps working while the plan is still on
Spark:

```bash
# admin-web/.env.local
VITE_ENABLE_ACCOUNT_ACTIONS=true
```

With the flag on, a **Danger zone** card appears on the user investigation page
with *Disable sign-in* / *Re-enable sign-in* and *Delete account*. Every call
fails closed if the functions are not deployed: the portal shows the error and
nothing changes.
