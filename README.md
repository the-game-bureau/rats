# The Very REEL Game Show — RSVP site

Static page (`index.html`) hosted on **GitHub Pages** + a tiny **Node backend**
(`server.js`) that records RSVPs and tracks the first 8 Venmo spots.

## Files
- `index.html` — the brutalist invite + RSVP form
- `rat.jpg` — host photo + social share thumbnail
- `server.js` — zero-dependency RSVP backend (writes `rsvps.csv`)
- `package.json` / `render.yaml` — deploy config

## Run locally
```
node server.js
```
Open http://localhost:3000. RSVPs are saved to `rsvps.csv`.
(Locally `BACKEND_URL` in index.html is `''`, so the form posts to the same origin.)

## Deploy (two parts)

### 1. Backend → Render (free)
1. Push this repo to GitHub.
2. On [render.com](https://render.com): **New → Blueprint**, pick this repo (it reads `render.yaml`).
3. After it deploys you'll get a URL like `https://reel-rats-rsvp.onrender.com`.
4. (Optional, tighter security) Set the `ALLOW_ORIGIN` env var to your Pages URL.

> Note: Render's free tier sleeps when idle, so the very first RSVP after a quiet
> spell may take ~30s to wake the server. Fine for an event invite.

### 2. Frontend → GitHub Pages
1. In `index.html`, set `BACKEND_URL` to your Render URL (no trailing slash):
   ```js
   var BACKEND_URL = 'https://reel-rats-rsvp.onrender.com';
   ```
2. Commit, then in the repo: **Settings → Pages → Deploy from branch → `main` / root**.
3. Your invite is live at `https://<your-username>.github.io/<repo>/`.

## Where do the RSVPs go?
Into `rsvps.csv` on the backend host. On Render's free tier the filesystem is
ephemeral (a redeploy can reset it), so for a short-lived event check the list
before redeploying — or ask and I'll switch storage to email-on-submit or a
hosted database.
