// GEGENEREERD door scripts/audit-grip.mts (npm run audit:grip -- --write) uit de geometrie van de verwerkte pose-GLB's. Niet met de hand bewerken.
// Meters in de ruimte van het pose-GLB (pivot onderkant-midden, 1,8 m, voorkant +Z). "links" = de linkerhand van de leerling (aan +X).
// confidence "hoog": twee armstukken gevonden; "laag": één hand, of links/rechts onzeker (zie docs/grip-audit.md).

export type HandPointsEntry = { links: [number, number, number] | null; rechts: [number, number, number] | null; confidence: "hoog" | "laag" };

export const HAND_POINTS: Record<string, HandPointsEntry> = {
  "standaard": {
    "links": [
      0.21,
      0.725,
      0.116
    ],
    "rechts": [
      -0.246,
      0.728,
      0.007
    ],
    "confidence": "hoog"
  },
  "hardlopen": {
    "links": [
      0.27,
      0.906,
      0.007
    ],
    "rechts": [
      -0.324,
      1.04,
      0.098
    ],
    "confidence": "hoog"
  },
  "juichen": {
    "links": [
      -0.054,
      1.529,
      -0.002
    ],
    "rechts": [
      -0.206,
      2.117,
      -0.058
    ],
    "confidence": "hoog"
  },
  "zittend": {
    "links": [
      0.077,
      0.309,
      0.216
    ],
    "rechts": [
      -0.26,
      0.326,
      0.024
    ],
    "confidence": "hoog"
  },
  "basketbal_dribbelen": {
    "links": [
      0.318,
      0.521,
      0.282
    ],
    "rechts": [
      -0.491,
      0.86,
      0.083
    ],
    "confidence": "hoog"
  },
  "volleybal_onderhands": {
    "links": [
      0.296,
      0.317,
      0.016
    ],
    "rechts": [
      -0.167,
      0.742,
      0.347
    ],
    "confidence": "hoog"
  },
  "volleybal_bovenhands": {
    "links": [
      0.255,
      1.349,
      0.04
    ],
    "rechts": [
      0.05,
      1.382,
      0.003
    ],
    "confidence": "hoog"
  },
  "pickleball_klaar": {
    "links": [
      0.314,
      0.346,
      0.038
    ],
    "rechts": [
      -0.067,
      0.679,
      0.236
    ],
    "confidence": "hoog"
  },
  "pickleball_slaan": {
    "links": [
      0.573,
      0.993,
      -0.487
    ],
    "rechts": [
      -0.15,
      0.782,
      0.413
    ],
    "confidence": "hoog"
  },
  "hockey": {
    "links": [
      0.042,
      0.41,
      0.203
    ],
    "rechts": [
      -0.241,
      0.278,
      0.435
    ],
    "confidence": "hoog"
  },
  "hockey_sprint": {
    "links": [
      0.162,
      0.884,
      0.197
    ],
    "rechts": [
      -0.253,
      0.607,
      0.365
    ],
    "confidence": "hoog"
  },
  "floorball": {
    "links": [
      0.288,
      1.086,
      -0.089
    ],
    "rechts": [
      -0.096,
      0.473,
      0.238
    ],
    "confidence": "hoog"
  },
  "floorball_sprint": {
    "links": [
      0.138,
      0.687,
      0.202
    ],
    "rechts": [
      -0.124,
      0.872,
      0.128
    ],
    "confidence": "hoog"
  },
  "honkbal_slaan": {
    "links": [
      0.305,
      0.336,
      0.112
    ],
    "rechts": [
      -0.257,
      1.207,
      -0.242
    ],
    "confidence": "hoog"
  },
  "honkbal_vangen": {
    "links": [
      -0.007,
      1.384,
      0.001
    ],
    "rechts": [
      -0.252,
      1.011,
      0.425
    ],
    "confidence": "hoog"
  },
  "trefbal_gooien": {
    "links": [
      0.269,
      1.163,
      0.717
    ],
    "rechts": [
      -0.48,
      1.19,
      -0.355
    ],
    "confidence": "hoog"
  },
  "handbal": {
    "links": [
      0.683,
      1.078,
      0.382
    ],
    "rechts": [
      0.119,
      1.603,
      0.111
    ],
    "confidence": "hoog"
  },
  "korfbal": {
    "links": [
      0.172,
      1.072,
      0.203
    ],
    "rechts": [
      -0.373,
      1.108,
      0.182
    ],
    "confidence": "hoog"
  },
  "basketbal_schot": {
    "links": [
      -0.057,
      1.416,
      -0.067
    ],
    "rechts": [
      -0.278,
      1.382,
      0.143
    ],
    "confidence": "hoog"
  },
  "tafeltennis": {
    "links": [
      0.34,
      1.082,
      -0.074
    ],
    "rechts": [
      -0.398,
      0.922,
      0.107
    ],
    "confidence": "hoog"
  },
  "football_rennen": {
    "links": [
      0.328,
      0.921,
      -0.379
    ],
    "rechts": [
      0.071,
      0.946,
      0.296
    ],
    "confidence": "hoog"
  },
  "football_passen": {
    "links": [
      0.769,
      1.442,
      0.054
    ],
    "rechts": [
      0.131,
      1.503,
      0.013
    ],
    "confidence": "hoog"
  },
  "rugby_tackle": {
    "links": [
      0.281,
      0.804,
      0.221
    ],
    "rechts": [
      0.122,
      1.102,
      0.137
    ],
    "confidence": "hoog"
  },
  "tikspel": {
    "links": [
      0.567,
      0.794,
      0.228
    ],
    "rechts": [
      -0.65,
      0.28,
      -0.049
    ],
    "confidence": "hoog"
  },
  "frisbee": {
    "links": [
      0.735,
      0.878,
      0.363
    ],
    "rechts": [
      -0.649,
      1.029,
      -0.203
    ],
    "confidence": "hoog"
  },
  "honkbal_pitchen": {
    "links": [
      0.325,
      0.35,
      -0.1
    ],
    "rechts": [
      0.027,
      1.365,
      -0.018
    ],
    "confidence": "hoog"
  },
  "startblokken": {
    "links": [
      0.1,
      0.318,
      -0.388
    ],
    "rechts": [
      -0.118,
      0.325,
      -0.051
    ],
    "confidence": "hoog"
  },
  "hoogspringen": {
    "links": [
      -0.012,
      0.813,
      0.837
    ],
    "rechts": [
      -0.434,
      0.746,
      -0.731
    ],
    "confidence": "hoog"
  },
  "discuswerpen": {
    "links": [
      0.594,
      1.146,
      0.53
    ],
    "rechts": [
      -0.572,
      0.892,
      -0.34
    ],
    "confidence": "hoog"
  },
  "kogelstoten": {
    "links": [
      0.73,
      1.472,
      0.355
    ],
    "rechts": [
      -0.417,
      1.124,
      0.142
    ],
    "confidence": "hoog"
  },
  "speerwerpen": {
    "links": [
      -0.069,
      1.482,
      -0.065
    ],
    "rechts": [
      -0.624,
      1.263,
      -0.214
    ],
    "confidence": "hoog"
  },
  "speer_klaarstand": {
    "links": [
      0.099,
      0.917,
      0.181
    ],
    "rechts": [
      -0.382,
      1.116,
      0.054
    ],
    "confidence": "hoog"
  },
  "fietsband": {
    "links": [
      0.057,
      1.498,
      0.057
    ],
    "rechts": [
      -0.441,
      0.948,
      -0.029
    ],
    "confidence": "hoog"
  },
  "balanceren": {
    "links": [
      0.771,
      1.287,
      -0.007
    ],
    "rechts": [
      -0.871,
      1.287,
      -0.003
    ],
    "confidence": "hoog"
  },
  "handstand": {
    "links": [
      0.123,
      1.291,
      0.031
    ],
    "rechts": [
      0.039,
      0.361,
      0.104
    ],
    "confidence": "laag"
  },
  "salto": {
    "links": [
      -0.047,
      0.466,
      -0.172
    ],
    "rechts": null,
    "confidence": "laag"
  },
  "landen": {
    "links": [
      0.743,
      1.356,
      0.167
    ],
    "rechts": [
      -0.748,
      1.355,
      0.165
    ],
    "confidence": "hoog"
  },
  "judo": {
    "links": [
      0.191,
      0.985,
      0.225
    ],
    "rechts": [
      -0.22,
      1.02,
      0.133
    ],
    "confidence": "hoog"
  },
  "judo_worp": {
    "links": [
      0.454,
      1.303,
      0.389
    ],
    "rechts": [
      -0.313,
      1.063,
      0.155
    ],
    "confidence": "hoog"
  },
  "judo_partij": {
    "links": [
      -0.207,
      0.945,
      0.36
    ],
    "rechts": [
      -0.239,
      1.382,
      0.113
    ],
    "confidence": "laag"
  },
  "judo_zittend": {
    "links": [
      0.225,
      0.309,
      0.084
    ],
    "rechts": [
      -0.215,
      0.293,
      0.102
    ],
    "confidence": "hoog"
  },
  "bal_schieten": {
    "links": [
      0.406,
      0.868,
      0.4
    ],
    "rechts": [
      -0.747,
      1.01,
      -0.267
    ],
    "confidence": "hoog"
  }
};
