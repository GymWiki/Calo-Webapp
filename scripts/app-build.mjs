// Bouwt de lokale schil (www/) van de native app. De app toont verder de
// live webapp (capacitor.config.ts → server.url); deze schil is wat de
// gebruiker ziet zolang die nog laadt of NIET bereikbaar is (offline).
// Geen build van Next.js nodig: de webapp zelf wordt niet meegebundeld,
// zodat een webupdate geen winkelrelease vergt.
import { mkdir, writeFile } from "node:fs/promises";

const LIVE_URL = process.env.APP_LIVE_URL ?? "https://www.gymwiki.nl";

const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="color-scheme" content="dark light" />
<title>GymWiki</title>
<style>
  html, body { height: 100%; margin: 0; background: #002f4f; }
  body { display: flex; align-items: center; justify-content: center; text-align: center;
    padding: env(safe-area-inset-top) 24px env(safe-area-inset-bottom);
    font-family: -apple-system, system-ui, sans-serif; color: #f6f5f1; }
  button { margin-top: 16px; min-height: 48px; padding: 0 24px; border: 0; border-radius: 12px;
    background: #f97316; color: #fff; font-size: 16px; font-weight: 600; }
  [hidden] { display: none; }
</style>
</head>
<body>
  <main>
    <p id="loading">GymWiki laden…</p>
    <div id="offline" hidden>
      <h1 style="font-size:20px;margin:0 0 8px">Geen verbinding</h1>
      <p style="margin:0;opacity:.8">Controleer je internet en probeer het opnieuw.</p>
      <button type="button" id="retry">Opnieuw proberen</button>
    </div>
  </main>
<script>
  var live = ${JSON.stringify(LIVE_URL)};
  function go() {
    document.getElementById("offline").hidden = true;
    document.getElementById("loading").hidden = false;
    fetch(live + "/favicon.ico", { method: "HEAD", mode: "no-cors", cache: "no-store" })
      .then(function () { window.location.replace(live); })
      .catch(function () {
        document.getElementById("loading").hidden = true;
        document.getElementById("offline").hidden = false;
      });
  }
  document.getElementById("retry").addEventListener("click", go);
  window.addEventListener("online", go);
  go();
</script>
</body>
</html>
`;

const offline = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>GymWiki — offline</title>
<style>
  html, body { margin: 0; background: #002f4f; color: #f6f5f1; font-family: -apple-system, system-ui, sans-serif; }
  main { padding: calc(env(safe-area-inset-top) + 32px) 24px calc(env(safe-area-inset-bottom) + 24px); max-width: 560px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 8px; } p { opacity: .85; line-height: 1.5; }
  button { min-height: 48px; padding: 0 24px; border: 0; border-radius: 12px; background: #f97316; color: #fff; font-size: 16px; font-weight: 600; }
  ul { list-style: none; padding: 0; margin: 16px 0 0; } li a { display: block; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,.15); color: inherit; text-decoration: none; }
</style>
</head>
<body>
  <main>
    <h1>Geen verbinding</h1>
    <p>GymWiki kan nu niet laden. Controleer je internet en probeer het opnieuw.</p>
    <button type="button" id="retry">Opnieuw proberen</button>
    <div id="recent" hidden><h2 style="font-size:16px;margin:28px 0 0">Recent bekeken</h2><ul id="list"></ul></div>
  </main>
<script>
  var live = ${JSON.stringify(LIVE_URL)};
  document.getElementById("retry").addEventListener("click", function () { window.location.replace(live); });
  window.addEventListener("online", function () { window.location.replace(live); });
  try {
    window.Capacitor.Plugins.Preferences.get({ key: "gymwiki.recent" }).then(function (r) {
      var items = r && r.value ? JSON.parse(r.value) : [];
      if (!items.length) return;
      var ul = document.getElementById("list");
      items.forEach(function (it) {
        var li = document.createElement("li"), a = document.createElement("a");
        a.href = live + "/activiteit/" + encodeURIComponent(it.id); a.textContent = it.title; li.appendChild(a); ul.appendChild(li);
      });
      document.getElementById("recent").hidden = false;
    });
  } catch (e) {}
</script>
</body>
</html>
`;

await mkdir("www", { recursive: true });
await writeFile("www/offline.html", offline);
await writeFile("www/index.html", html);
console.log(`www/index.html geschreven (live-url: ${LIVE_URL})`);
