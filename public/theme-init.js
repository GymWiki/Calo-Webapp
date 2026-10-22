// Zet de `dark`-class op <html> vóórdat de pagina schildert (voorkomt een
// lichte flits bij het laden in dark mode). Als los, statisch bestand i.p.v.
// een inline <script> in app/layout.tsx — nodig om een Content-Security-Policy
// zonder 'unsafe-inline' te kunnen voeren (zie next.config.ts). Voorkeur:
// localStorage ("theme"), anders het systeemvoorkeur; zie
// components/theme-toggle.tsx voor waar "theme" geschreven wordt.
(function () {
  try {
    var t = localStorage.getItem("theme");
    var d = t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", d);
  } catch (e) {
    // Best-effort — een gemiste theme-init is geen kritieke fout.
  }
})();
