# Puran Haat — Barter Marketplace App

A **React Native / Expo** barter marketplace where users trade items locally — no cash required. Built with Firebase for authentication, real-time Firestore sync, and optional Cloud Storage for profile photos.

---

## 🚀 Features

| Feature | Description |
|---------|-------------|
| **Email/Password + Google Sign-In** | Web uses Firebase `signInWithPopup`; iOS/Android use Google's native Sign-In SDK |
| **Email Verification Required** | Only verified users can post items, chat, or send proposals |
| **Real-time Home Feed** | `onSnapshot` listeners for items, favorites, conversations, proposals |
| **Post Items** | Category, condition, trade mode (barter / free gift), eco impact rating, CO₂ saved |
| **Favorites** | Heart items, stored in `favorites` subcollection |
| **Chat & Proposals** | Conversations with message subcollections; proposals with status flow (pending → accepted → completed) |
| **Proposal Inbox** | Chats tab splits into conversations and real proposals, highlighting offers that need your response |
| **Listing Management** | My Listings screen to edit or delete your own items; owner actions also appear on item detail |
| **Search Filters** | Discover filters by text, category, and distance; recent searches persist per user |
| **Profile & Edit Profile** | Avatar upload via Firebase Storage (optional — needs Blaze plan), bio, district, username |
| **Eco Impact Tracking** | Per-user eco points, trade count, CO₂ savings |
| **Security Rules** | Hardened Firestore + Storage rules with ownership, verified-email writes, immutable fields, and status guards |
| **Tabs** | Home, Discover, Post, Chats, Profile |

---

## 🛠 Tech Stack

- **Framework**: Expo SDK 57 (React Native 0.86, React 19)
- **Routing**: Expo Router (file-based, typed routes)
- **Backend**: Firebase
  - **Auth**: Email/Password + Google (web + native)
  - **Firestore**: Real-time subscriptions, compound indexes
  - **Storage**: Avatars (requires the Blaze plan; profile edits still save without it)
- **State**: React Context + hooks (no Redux)
- **UI**: `@expo/ui` native components (BottomSheet, Picker, Switch, etc.)
- **Styling**: Custom theme tokens + StyleSheet
- **TypeScript**: Strict mode throughout

---

## 📦 Getting Started

### Prerequisites

- Node.js 20+
- npm (a `package-lock.json` is committed)
- Firebase project (see **Firebase Setup** below)

### Install & Run

```bash
# Install dependencies
npm install

# Copy environment template and fill in your Firebase credentials
cp .env.example .env.local

# Web dev server
npx expo start --web

# Native development build (required for Google Sign-In)
npm run android   # or: npm run ios (macOS only)
```

Open in:
- **Web**: `npx expo start --web` or visit `http://localhost:8081`
- **iOS Simulator**: `npm run ios` (macOS only — builds and installs the dev client)
- **Android Emulator**: `npm run android` (builds and installs the dev client)
- **Expo Go**: `npx expo start` then scan the QR (limited — no Google Sign-In or other custom native modules)

> ⚠️ Google Sign-In on iOS/Android requires a **development build** (`npx expo run:ios` / `npx expo run:android`, or an EAS development build). It uses the native Google Sign-In SDK and **will not work in Expo Go**.
>
> If native Google sign-in reports `DEVELOPER_ERROR` / `10`, the build's SHA-1 is not registered. Run `npx @react-native-google-signin/config-doctor`, add the fingerprint to the Firebase Android app, and rebuild.

---

## 🔐 Firebase Setup

1. **Create a Firebase project** (or use `puran-haat-app`):
   - Enable **Firestore** (region `asia-south1` recommended for South Asia)
   - Enable **Storage** *(optional — Firebase now requires the Blaze plan. Skip it to run the app without avatar uploads; all other profile fields still save)*
   - Enable **Authentication** → Sign-in methods:
     - Email/Password
     - Google (add authorized domains: `localhost`, your production domain)

2. **Register apps** in Firebase Console → Project Settings → General:
   - **Web** → copy `apiKey`, `authDomain`, `projectId`, `storageBucket`
   - **iOS** → bundle ID: `com.puranhaat.app` → download `GoogleService-Info.plist`
   - **Android** → package: `com.puranhaat.app` → add **debug SHA-1** (and release SHA-1 later) → download `google-services.json`

   Both native config files are committed at the repo root and are read by the Google Sign-In config plugin. Regenerate them after changing Firebase apps or signing certificates:
   ```bash
   npx firebase-tools apps:list --project puran-haat-app
   npx firebase-tools apps:sdkconfig ANDROID <androidAppId> --project puran-haat-app --out google-services.json
   npx firebase-tools apps:sdkconfig IOS <iosAppId> --project puran-haat-app --out GoogleService-Info.plist
   ```

3. **Add credentials to `.env.local`**:
   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=...
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...

   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
   ```

   Native Google client IDs come from the committed `google-services.json` / `GoogleService-Info.plist`, not from environment variables.

   For EAS cloud builds, add the same `EXPO_PUBLIC_*` variables to the EAS environment (`eas env:create`) — `.env.local` is intentionally gitignored and is not uploaded.

4. **Deploy security rules** (from repo root):
   ```bash
   npx firebase-tools deploy --only firestore:rules,firestore:indexes --project puran-haat-app
   ```

   Deploy `storage.rules` separately only after Storage is provisioned on the Blaze plan:
   ```bash
   npx firebase-tools deploy --only storage
   ```

---

## 📁 Project Structure

```
src/
├── app/                    # Expo Router screens
│   ├── (tabs)/             # Tab screens: index (Home), search (Discover), post, messages (Chats), profile
│   ├── auth.tsx            # Sign in / up / Google
│   ├── chat/[id].tsx       # Real-time chat with proposals
│   ├── edit-item/[id].tsx  # Owner-only listing edit form
│   ├── edit-profile.tsx    # Avatar picker + profile fields
│   ├── help.tsx            # Help & FAQ
│   ├── item/[id].tsx       # Item detail + propose
│   ├── my-listings.tsx     # Manage your own listings
│   ├── notifications.tsx   # Activity feed
│   ├── proposal/[id].tsx   # Create a trade proposal for an item
│   ├── trust-safety.tsx    # Community guidelines
│   └── _layout.tsx         # Root layout + providers
├── components/
│   ├── auth/               # AuthGate, VerificationBanner
│   ├── layout/             # TopHeader
│   └── ui/                 # CategoryChip, ItemCard, SearchBar
├── context/
│   ├── AuthContext.tsx     # Firebase auth state + helpers
│   └── AppContext.tsx      # Firestore subscriptions + mutations
├── hooks/
│   ├── useAuthGuard.ts     # Gate features behind auth+verification
│   └── useConversationMessages.ts
├── lib/
│   ├── firebase.ts         # Firebase SDK init, helpers, uploadProfileAvatar
│   ├── google-signin.ts    # Native Google Sign-In → Firebase ID token
│   ├── notifications.ts    # Derives the activity feed from proposals + chats
│   └── recent-searches.ts  # AsyncStorage-backed recent searches per user
├── constants/
│   ├── colors.ts
│   └── theme.ts
├── data/
│   └── mock-items.ts       # Seed data for dev
└── types/
    └── index.ts            # Item, Profile, TradeProposal, Conversation…
```

---

## ✅ Quality Checks

```bash
npx tsc --noEmit        # TypeScript strict check
npx expo lint           # ESLint (Expo config)
npx expo-doctor         # Dependency / config health
```

---

## 📲 Building for Stores

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure project (first time)
eas build:configure

# Build for iOS / Android
eas build --platform ios
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

> **Important**: Add your **production SHA-1** (from Play Console → App Integrity) to the Firebase Android app before building release variants.

---

## 🌐 Web Deployment (Static SPA)

```bash
npx expo export --platform web   # outputs to dist/
# Deploy dist/ to Firebase Hosting, Vercel, Netlify, etc.
# SPA fallback rewrite required: /* → /index.html
```

---

## 📄 License

MIT — free to use, modify, and distribute.

---

## 🙏 Acknowledgements

- [Expo](https://expo.dev) & [React Native](https://reactnative.dev)
- [Firebase](https://firebase.google.com) for backend
- [@expo/ui](https://github.com/expo/expo/tree/main/packages/expo-ui) for native components
- Community packages: `expo-auth-session`, `expo-image-picker`, `react-native-reanimated`, `expo-router`