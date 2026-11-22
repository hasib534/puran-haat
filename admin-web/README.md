# Puran Haat — Admin Portal

Standalone web dashboard for the Puran Haat marketplace: trader verification,
moderation, community auctions and sustainability rewards. It talks to the same
Firebase project as the Expo app (`puran-haat-app`) and reads the same
collections, so no data is duplicated.

Screens follow the `stitch_puran_haat/admin_*` designs:

| Design file | Route |
| --- | --- |
| `admin_login` | `/login` |
| `admin_overview` | `/` |
| `user_management` | `/users` |
| `user_investigation` | `/users/:id` |
| `verification_detail` | `/verifications/:id` |
| `auction_control` | `/auctions` |
| `schedule_auction` | `/auctions/new` |
| `rewards_recognition` | `/rewards` |
| `reward_configuration` | `/rewards/configure` |

Stack: Vite + React + TypeScript + Tailwind CSS v4 (design tokens copied from the
Stitch mockups into `src/index.css`).

## Setup

```bash
cd admin-web
npm install
cp .env.example .env.local     # then fill in the values
npm run dev                    # http://localhost:5174
```

`.env.local` values come from **Firebase console → Project settings → Your apps
→ Web app**. Only the API key, auth domain and project ID are needed — the
portal uses Firebase Auth and Firestore only.

## Admin access

Admin rights are **never** a client-side flag. Access is a roster document:

1. Sign the future moderator in once at `/login` so Auth creates their account.
2. Copy their UID from **Firebase console → Authentication → Users**.
3. Create a document at **Firestore → `admins` → `<uid>`** with
   `{ "role": "super_admin", "title": "Super Admin Office" }`
   (`role` may be `super_admin` or `moderator`).

`firestore.rules` verifies that document on every admin read and write with an
`exists()` check, so a client can never promote itself. Because the console
bypasses rules, this bootstrap step is the single place admins are minted.

Deploy the rules from the repository root whenever they change:

```bash
firebase deploy --only firestore:rules
```

## Demo content

`Settings → Demo content` (and the Overview header when every collection is
empty) loads the sample records from the design file. Every demo row uses a
`demo-` document id and a synthetic `demo-*` user id, so re-running overwrites
the same documents and never touches a real trader. Listings are intentionally
not seeded — `items` is public-read and would leak into the mobile app's feed.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server on port 5174 |
| `npm run build` | Typecheck (`tsc --noEmit`) then production build |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm run deploy` | Build and deploy to Firebase Hosting |

## Deploying to Firebase Hosting

The nested `firebase.json` publishes `dist` as a single-page app:

```bash
cd admin-web
npx firebase-tools login         # once
npx firebase-tools use puran-haat-app
npm run deploy
```

## What the portal cannot do

- **Read chat messages.** `conversations` / `messages` are participant-only in
  Firestore; a Cloud Function with the Admin SDK would be required. The
  investigation screen explains this instead of showing an empty thread.
- **Award eco-points to a user's wallet.** Manual grants are written to
  `rewardGrants`, the ledger the app reads; the server owns `users.eco_points`.
- **Create or promote admins from the UI.** That is console/Admin-SDK work by
  design (see above).
