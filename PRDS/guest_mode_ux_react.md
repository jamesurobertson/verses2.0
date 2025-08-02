# 🧑‍🚀 Guest Mode + Sync UX for React + Supabase + Dexie

This document outlines how to build a great user experience for a Bible memory React app that supports guest mode (no login required) with Dexie (IndexedDB) for local storage and Supabase for optional cloud sync after signup.

---

## 🔄 1. Instant Onboarding (No Sign-In Required)

**Goal:** Let users use the core features right away.

- Display main app features immediately (e.g., review cards, add verses).
- Silently generate/store a guest UUID (if not already present).
- Use Dexie to save all verse data locally from the start.

💡 *No need for a "Start" button. Users land right on the working app.*

---

## 🧭 2. Subtle "Guest Mode" Indicator

**Goal:** Let users know they’re not logged in and what that means.

- Show a non-intrusive banner or tooltip:

  > “You’re using guest mode. Data is saved only on this device.”

- Optionally use a dismissible toast or top bar only on the first visit.

---

## 🔐 3. Light CTA to Sign In or Sync

**Goal:** Prompt account creation without pressure.

- Top-right corner: `Sign in to back up your progress`
- Bottom corner: Floating chip/button: `Save to cloud`

Incentives to mention:

- ✅ Sync across devices
- 🔁 Automatic backup
- 💡 Never lose your verses

🟨 Do **not** block any functionality for guests.

---

## 🛑 4. Do NOT Force Signup

Avoid these friction points:

- ❌ Modal requiring login
- ❌ Mandatory account creation before app use
- ❌ Email prompt just to start using the app

---

## 💬 5. Sync Gracefully After Login

### Before login:

- Notify user: *"Your local progress will be saved to your account."*

### After login:

- Merge and upload Dexie data to Supabase.
- Show confirmation toast:
  > "✅ Your local progress has been synced to your account."

---

## ⚙️ 6. Integration Guide (Dexie + Supabase + React)

### Step 1: Generate Guest ID

```ts
import { v4 as uuidv4 } from 'uuid';

const GUEST_ID_KEY = 'guest_id';

export function getOrCreateGuestId(): string {
  const existing = localStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const newId = uuidv4();
  localStorage.setItem(GUEST_ID_KEY, newId);
  return newId;
}
```

### Step 2: Dexie Setup

Ensure your Dexie schema can work without needing a logged-in user:

```ts
const db = new Dexie('versesDb');
db.version(1).stores({
  verses: '++id, reference, text, category, synced',
});
```

### Step 3: Syncing Logic

Create sync function for uploading local Dexie data to Supabase after sign-in.

```ts
async function syncToSupabase(userId: string) {
  const localVerses = await db.verses.where('synced').equals(false).toArray();
  for (const verse of localVerses) {
    await supabase.from('verses').insert({
      user_id: userId,
      reference: verse.reference,
      text: verse.text,
      category: verse.category,
    });
    await db.verses.update(verse.id, { synced: true });
  }
}
```

### Step 4: Auth Listener

Listen for auth changes and trigger sync.

```ts
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    syncToSupabase(session.user.id);
  }
});
```

---

## 🧪 Optional Enhancements

| Feature              | Description                                       |
| -------------------- | ------------------------------------------------- |
| **Progress Badge**   | Encourage sign-in by showing streaks or progress  |
| **Analytics Opt-in** | Ask to track anonymous usage                      |
| **Local Warning**    | Warn that data will be lost on cookie/cache clear |

---

## 🧑‍💻 Example UI Snippets

```tsx
<Banner>
  You're using guest mode. <Link onClick={signIn}>Sign in to save your progress →</Link>
</Banner>

<Button variant="outline" onClick={signIn}>
  🔐 Sign in to sync your verses
</Button>
```

---

## ✅ Summary

| UX Goal                 | Approach                     |
| ----------------------- | ---------------------------- |
| Instant access          | No login gate                |
| Light guest messaging   | Subtle toast or banner       |
| Optional sign-in        | Button or link, not modal    |
| Sync after login        | Silent with success feedback |
| Local-only data warning | Toast: "Only saved locally"  |

---

Save this doc for reference when updating your app's authentication flow. Let users love the app *before* asking for an account!

