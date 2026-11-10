# METAKNOWIA – AI Study App (mobile app)

React Native app ng METAKNOWIA: AI reviewer, quiz, class schedule na may reminders, at si METANOIA, ang interactive na robot study buddy.

| | Version |
|---|---|
| Language | **TypeScript** |
| Framework | **React Native 0.88 + Expo SDK 58** (React 19.3) |
| Navigation | Expo Router (file-based, `src/app/`) |
| Database / Backend | **Firebase**: Auth, Firestore, Storage, Cloud Functions |
| Robot animation | `react-native-svg` + `react-native-reanimated` |

---

## 1. Unang setup (isang beses lang)

**Kailangan:** Node.js 22, at isang Android phone na may **Expo Go** o isang Android emulator.

```bash
npm install
```

### Gumawa ng Firebase project
1. Pumunta sa <https://console.firebase.google.com>, tapos piliin ang **Add project**.
2. Sa **Build › Authentication › Sign-in method**, i-enable ang **Email/Password**.
3. Sa **Build › Firestore Database**, piliin ang **Create database** at gamitin ang location na **asia-southeast1 (Singapore)**.
4. Sa **Build › Storage**, piliin ang **Get started** (kailangan ito para sa pag-upload ng PDF at photo).
5. Sa **Project settings › General › Your apps**, i-click ang **Web** (`</>`) icon, tapos kopyahin ang config.

### Ilagay ang keys
```bash
cp .env.example .env
```
Buksan ang `.env` at i-paste ang mga value: `apiKey`, `authDomain`, `projectId` at iba pa.
Hindi ito secrets. Ang nagpoprotekta sa data ay ang security rules sa `firebase/`.

### I-deploy ang security rules
```bash
cp .firebaserc.example .firebaserc
```
Palitan ang `your-firebase-project-id` sa `.firebaserc` ng project ID ninyo, tapos patakbuhin ito:
```bash
npx firebase-tools login
```
```bash
npm run deploy:rules
```

## 2. Patakbuhin ang app

```bash
npx expo start -c
```
I-scan ang QR code gamit ang **Expo Go** (Android), o pindutin ang `a` para sa Android emulator.

Pagkatapos mag-sign up, pumunta sa **Profile › Load sample data**. Maglalagay ito ng 3 folders, isang PE reviewer at isang weekly class schedule para may ma-test agad kayo.

> **Development build:** May mga feature na mas maaasahan sa development build kaysa sa Expo Go, gaya ng notifications at pag-save sa Gallery. Kailangan din ito para sa Google Sign-In sa susunod. Gumawa nito gamit ang `npx expo run:android`, o gamit ang EAS: `npx eas-cli@latest build --profile development --platform android`.

## 3. AI: Gemini

Lahat ng AI ay dumadaan sa `src/lib/ai.ts`. Pinipili ang mode sa `.env`:

| `EXPO_PUBLIC_AI_MODE` | Ano ang nangyayari |
|---|---|
| `mock` | Practice mode na tumatakbo sa phone, walang AI, at libre. |
| **`gemini`** (recommended) | **Gemini sa pamamagitan ng Firebase AI Logic** (`src/lib/ai-gemini.ts`). **Walang API key sa app, walang Cloud Functions, at gumagana sa libreng Spark plan.** Nababasa nito ang pasted notes, PDF, TXT at mga photo. |
| `functions` | Sariling Cloud Functions sa `functions/`. Kailangan nito ng Blaze plan. |

**Paano i-on ang Gemini:**
1. Sa Firebase console, pumunta sa **AI services › AI Logic**, tapos **Get started**, at piliin ang **Gemini Developer API**. Hindi kailangan ng credit card.
2. Sa `.env`:
   ```
   EXPO_PUBLIC_AI_MODE=gemini
   EXPO_PUBLIC_GEMINI_MODEL=gemini-3.6-flash
   ```
   Kung "model not found" ang lumabas, palitan ang `EXPO_PUBLIC_GEMINI_MODEL` ng model na nakalista sa AI Logic page.
3. **App Check debug token.** Kailangan ito, dahil naka-enforce ang App Check sa AI Logic.
   - Pumunta sa Firebase console › **Security › App Check › Apps**.
   - Sa **metaknows Web App**, i-click ang **⋮**, tapos **Manage debug tokens**, tapos **Add debug token**.
   - Bigyan ito ng pangalan (halimbawa "dev-laptop"), i-**Generate**, i-copy ang token, at i-**Save**.
   - Sa `.env`, ilagay ang `EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN=<token>`.
   - **Pang-development lang ito.** Bago ibigay ang app sa ibang tao, palitan ito ng tunay na App Check provider (Play Integrity) at burahin ang debug token sa console.
4. I-restart ang Expo:
   ```bash
   npx expo start -c
   ```

**Mga file na nababasa ni Gemini:** PDF, TXT at mga photo (hanggang 15 MB). **Word at PowerPoint: i-save muna bilang PDF** (File › Save As › PDF).

**Free tier:** May limit kada minuto at kada araw ang Gemini Developer API. Kapag naabot ito, "METANOIA is busy right now" ang lalabas, kaya maghintay lang nang kaunti. Bago ang public release, i-on ang **Firebase App Check** para hindi magamit ng iba ang quota ninyo.

## 3b. Account, quick login at game features (v1.1)

- **Sign up:** kailangang pumasa ang password sa 5 rules: 8+ characters, uppercase, lowercase, number at special character.
- **Email verification:** pagka-sign up, nagpapadala ang Firebase ng **link**, at hindi papasok ang app hangga't hindi ito tina-tap.
  Para baguhin ang itsura o wika ng email: Firebase console › **Authentication › Templates › Email address verification**.
- **Quick login (PIN at fingerprint):** naka-save lang sa phone gamit ang encrypted SecureStore. Ang PIN ay hindi sine-save mismo, kundi ang salted SHA-256 nito.
  Kapag 5 beses nagkamali sa PIN, password na ang kailangan. Hindi ito available sa web preview.
- **Game rules** (XP, levels, stars, daily quests, journey goals at characters): nasa `src/lib/game.ts` lahat, kaya doon babaguhin ang mga numero.
- **Buddy robot sa Home:** ang mga sinasabi at emosyon niya ay nasa `src/lib/buddy.ts`.
- **Statistics:** nasa `src/lib/stats.ts`, para sa topic mastery, strength at weakness, rekomendasyon, at most missed questions.

## 4. Local testing gamit ang Firebase Emulator (walang totoong project)

Kailangan ng Java 21.
```bash
npm run emulators
```
Sa `.env`, ilagay ang `EXPO_PUBLIC_USE_EMULATORS=true`. Para sa `EXPO_PUBLIC_EMULATOR_HOST`:
- `10.0.2.2` kung Android emulator ang gamit
- Wi-Fi IP ng computer ninyo kung totoong phone

Makikita ang data sa <http://localhost:4000>.

## 5. Ayos ng code

```
src/
  app/                    ← bawat file ay isang screen (Expo Router)
    _layout.tsx           fonts, AuthProvider, login guard
    index.tsx             nagre-redirect: naka-login → /home, hindi → /login
    (auth)/login, signup  Sign up: First / Middle (Optional) / Last name
    (app)/(tabs)/         Home · Library · [+ Create] · Ask · Profile
    (app)/add-reviewer    paste notes / upload PDF-DOCX-PPT / photo → AI reviewer
    (app)/reviewer/[id]   detalye, AI summary, past attempts
    (app)/quiz/[id]       one question at a time, nare-resume ("Continue reviewing")
    (app)/results/[id]    score, per topic, tips mula sa robot
    (app)/schedule/       My Schedule, Scan photo (2 steps), Image (download/share)
    (app)/buddy           robot gestures + outfits
  components/
    Robot.tsx             ang robot: 7 gestures, outfits (head/face/neck), unlock rules
    RobotFab.tsx          robot na nakalutang sa Home; ang label ay lumalabas sa simula at kapag long-press
    ScheduleGrid.tsx      weekly timetable
    ui.tsx                buttons, fields, cards (galing sa METANOIA design system)
  lib/
    firebase.ts           Firebase init (+ emulators)
    auth-context.tsx      login, sign up, profile
    db.ts                 lahat ng Firestore reads at writes
    ai.ts                 mock ↔ Cloud Functions
    notifications.ts      class reminders + daily study reminder (local, offline)
functions/src/            Cloud Functions: generateReviewer, chatWithMetanoia, scanSchedule
firebase/                 firestore.rules, storage.rules
```

### Firestore data
```
users/{uid}                    firstName, middleName|null, lastName, email, gradeLevel,
                               outfit{head,face,neck}, remindersOn, reminderLeadMin, stats{…}
users/{uid}/folders/{id}       name, icon, tint
users/{uid}/reviewers/{id}     title, folderId, summary[], questionCount, bestPercent, …
  └ questions/{id}             prompt, choices[], answerIndex, explanation, topic
users/{uid}/attempts/{id}      reviewerId, correct, total, percent, byTopic
users/{uid}/classes/{id}       subject, code, color, day(1=Mon…7=Sun), start, end, room, teacher
users/{uid}/messages/{id}      role(user|bot), text
```
Sariling data lang ang nababasa at nasusulat ng bawat student. Nasubukan ito gamit ang emulator.
Walang kailangang composite index, dahil sa phone na ginagawa ang pag-sort ng filtered lists.

## 6. Magdagdag ng gesture o outfit para sa robot

Nasa `src/components/Robot.tsx` ang lahat:
- **Bagong outfit:** iguhit ito sa `OUTFIT_ART`, tapos idagdag sa `OUTFIT_ITEMS`. Puwede itong lagyan ng `lock` (unlock rule), halimbawa `streak >= 7`.
- **Bagong gesture:** magdagdag ng `case` sa `play()` at ng entry sa `GESTURES`.

## 7. Wala pa (susunod na gagawin)
- Google Sign-In (kailangan ng development build)
- Flashcards mode, Notifications inbox, Recently Deleted, Statistics page
- Push notifications mula sa server (FCM). Local na ang class at study reminders.

## 8. Mga check bago mag-commit
```bash
npm run typecheck
```
```bash
npm run lint
```
