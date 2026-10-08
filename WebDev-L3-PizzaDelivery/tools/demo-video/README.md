# Demo video and screenshot tooling

Optional tooling, separate from the app. It drives the built client with Playwright, records a 1280x720 video, adds captions with ffmpeg (`ffmpeg-static`) and takes the README screenshots. It reads `server/.env` at run time and never prints it.

```bash
cd client && npm run build                       # build the client
PORT=5100 CLIENT_URL=http://localhost:5273 node ../server/src/server.js   # API (second terminal)
node serve.js 5273 5100                          # serves client/dist and proxies /api (third terminal)
npm install                                      # in this folder
node record.js ../../demo-video/work             # records raw.webm + scenes.json
node build.js ../../demo-video/work ../../demo-video/OIBSIP_PizzaDelivery_ZairaShahid.mp4
node screenshots.js ../../screenshots
```

Both scripts create a throw-away `@demo.invalid` customer, restore any inventory they change, and remove the account afterwards. The `demo-video/` output folder is git-ignored.
