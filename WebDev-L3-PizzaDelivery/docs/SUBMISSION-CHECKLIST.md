# Submission checklist (spec section 37)

Legend: ✅ verified (by whom is noted) · ☐ still to do (**you**) · the "Evidence" column says how it was checked or how to check it.

## Repository

| Item | Status | Evidence |
| --- | --- | --- |
| GitHub repository is named `OIBSIP` | ✅ | Remote is `github.com/Zaira-Shahid/OIBSIP` |
| Repository is public | ☐ | Open the repository in a private window while logged out of GitHub; it must load. Settings → General → Danger Zone → visibility |
| Correct task folder exists | ✅ | `WebDev-L3-PizzaDelivery/` containing `client/`, `server/`, `docs/`, `README.md`, `screenshots/` |
| Source code is present | ✅ | `client/src`, `server/src` |
| README.md is present and accurate | ✅ | Follows spec section 27; features, stack, architecture, 8-step setup, test accounts, screenshots, limitations |
| Screenshots / output files are present | ☐ | Nine PNGs in `screenshots/` (see `screenshots/README.md`); the README images show once they are committed |
| No secrets in the repository | ✅ | Final audit: `.env` is ignored and never committed; none of the 7 real secret values in `server/.env` appears in any tracked file or any commit (checked across all history) |

## Application (all verified in the browser by Zaira unless noted)

| Item | Status |
| --- | --- |
| User flow works end to end (register, verify, log in, build, pay, track) | ✅ |
| Admin flow works end to end (staff login, orders, status, inventory) | ✅ |
| Payment test flow works (Razorpay test mode) | ✅ |
| Inventory works (display, manual update, automatic decrement) | ✅ |
| Low-stock notification works (real email, no repeats) | ✅ |
| Real-time order tracking works | ✅ |
| Forgot / reset password and email verification with a real inbox | ✅ |
| Preset menu prices equal what the builder charges | ✅ (automated tests for every preset; Zaira checked the new prices and the pre-selection in the browser) |

## Video

| Item | Status |
| --- | --- |
| Screen recording (not a slideshow) | ☐ |
| First 2 seconds contain the full name | ☐ |
| First 2 seconds contain the assigned track | ☐ |
| First 2 seconds contain the task title | ☐ |
| End-to-end functionality demonstrated | ☐ |

Use [VIDEO-SCRIPT.md](VIDEO-SCRIPT.md) and [DEMO-CHECKLIST.md](DEMO-CHECKLIST.md).

## LinkedIn

| Item | Status |
| --- | --- |
| Demo video uploaded and linked in the post | ☐ |
| Oasis Infobyte tagged | ☐ |
| `#oasisinfobyte` | ☐ |
| Relevant domain hashtag (for example `#webdevelopment`) | ☐ |

Use [LINKEDIN-POST.md](LINKEDIN-POST.md).

## Peer evaluation

| Item | Status |
| --- | --- |
| Substantive comment on intern #1's video (mention something specific from it) | ☐ |
| Substantive comment on intern #2's video | ☐ |

## Final quality

| Item | Status | Evidence |
| --- | --- | --- |
| No obvious console errors | ☐ | Open the browser console (F12) while clicking through the demo flow once; there should be no red errors. The client contains no `console` calls |
| No exposed credentials | ✅ | See "No secrets in the repository" above |
| No broken routes | ✅ | Final audit: every client `Link`/`navigate` target is a defined route; unknown URLs show the 404 page; admin and customer areas redirect correctly |
| No fake or unfinished buttons | ✅ | Final audit: every button performs its real action. The earlier preset price/"Customize" gap was fixed in Module 11 |
| Responsive | ☐ | Resize the browser to about 360 px wide (or use the browser's device toolbar) and check: dashboard, builder, summary, admin inventory (turns into cards), admin orders |
| Accessibility basics | ✅ | Static scan: 0 buttons without a type, 0 images without alt text, 0 unlabelled form controls; skip link, page titles, visible focus, status messages announced; keyboard and screen-reader pass still worth a quick manual try |
| README accurate | ✅ | Re-read against the app at the final audit |
| Requirement matrix fully checked | ✅ | `docs/REQUIREMENTS.md`: every U and A row is ✅ |
| Automated tests pass | ✅ | `cd server && npm test`; client `npm run lint` and `npm run build` |

## Before you submit

- [ ] Set `LOW_STOCK_CHECK_CRON` back to `*/15 * * * *` (or remove it) in your local `.env`
- [ ] `git status` is clean on `main` and everything is pushed
- [ ] Restrict MongoDB Atlas *Network Access* from `0.0.0.0/0` to your own IP if the cluster is kept after the internship
