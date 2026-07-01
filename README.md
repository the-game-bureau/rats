# The Very REEL Game Show — RSVP site

A single static page (`index.html`) hosted on **GitHub Pages**. RSVPs are
collected by **Formspree** — no server, nothing to deploy, nothing to maintain.

## Files
- `index.html` — the brutalist invite + RSVP form
- `rat.jpg` — host photo + social share thumbnail

## Live
- Site: https://thegamebureau.com/rats/ (also https://the-game-bureau.github.io/rats/)

## How RSVPs work
The form posts to Formspree (`https://formspree.io/f/mjgqajey`). Each submission
is emailed to kevinmkolb@gmail.com and stored in the Formspree dashboard
(with CSV export). To change where they go, edit the form's settings in Formspree,
or swap `FORMSPREE_ENDPOINT` near the bottom of `index.html`.

## Editing
It's just one HTML file. Change the copy/design, commit, and push — GitHub Pages
redeploys automatically.
