// GEGENEREERD door scripts/audit-grip.mts (npm run audit:grip -- --write) uit de geometrie van de verwerkte pose-GLB's. Niet met de hand bewerken.
// Meters in de ruimte van het pose-GLB (pivot onderkant-midden, 1,8 m, voorkant +Z). "links" = de linkerhand van de leerling (aan +X).
// confidence "hoog": twee armstukken gevonden; "laag": één hand, of links/rechts onzeker (zie docs/grip-audit.md).

export type HandPointsEntry = { links: [number, number, number] | null; rechts: [number, number, number] | null; confidence: "hoog" | "laag" };

export const HAND_POINTS: Record<string, HandPointsEntry> = {
  "standaard": {
    "links": [
      0.168,
      0.403,
      -0.035
    ],
    "rechts": [
      -0.123,
      0.404,
      -0.118
    ],
    "confidence": "hoog"
  },
  "hardlopen": {
    "links": [
      0.295,
      0.968,
      -0.039
    ],
    "rechts": [
      -0.326,
      1.025,
      0.135
    ],
    "confidence": "hoog"
  },
  "juichen": {
    "links": [
      -0.088,
      1.61,
      -0.002
    ],
    "rechts": [
      -0.224,
      2.11,
      -0.054
    ],
    "confidence": "hoog"
  },
  "zittend": {
    "links": [
      0.082,
      0.308,
      0.215
    ],
    "rechts": [
      -0.26,
      0.325,
      0.021
    ],
    "confidence": "hoog"
  },
  "basketbal_dribbelen": {
    "links": [
      0.346,
      0.518,
      0.258
    ],
    "rechts": [
      -0.496,
      0.871,
      0.055
    ],
    "confidence": "hoog"
  },
  "volleybal_onderhands": {
    "links": [
      -0.158,
      0.742,
      0.352
    ],
    "rechts": null,
    "confidence": "laag"
  },
  "volleybal_bovenhands": {
    "links": [
      0.232,
      1.671,
      0.073
    ],
    "rechts": [
      0.074,
      1.472,
      0.016
    ],
    "confidence": "hoog"
  },
  "pickleball_klaar": {
    "links": [
      -0.083,
      0.677,
      0.235
    ],
    "rechts": null,
    "confidence": "laag"
  },
  "pickleball_slaan": {
    "links": [
      0.564,
      1,
      -0.501
    ],
    "rechts": [
      -0.148,
      0.774,
      0.409
    ],
    "confidence": "hoog"
  },
  "hockey": {
    "links": [
      0.103,
      0.431,
      0.14
    ],
    "rechts": [
      -0.246,
      0.277,
      0.43
    ],
    "confidence": "hoog"
  },
  "hockey_sprint": {
    "links": [
      0.343,
      1.183,
      0.04
    ],
    "rechts": [
      -0.255,
      0.602,
      0.357
    ],
    "confidence": "hoog"
  },
  "floorball": {
    "links": [
      0.302,
      1.044,
      -0.096
    ],
    "rechts": [
      0.12,
      0.358,
      0.028
    ],
    "confidence": "hoog"
  },
  "floorball_sprint": {
    "links": [
      0.102,
      0.392,
      0.147
    ],
    "rechts": [
      -0.261,
      1.035,
      0.039
    ],
    "confidence": "hoog"
  },
  "honkbal_slaan": {
    "links": [
      -0.333,
      1.197,
      -0.085
    ],
    "rechts": null,
    "confidence": "laag"
  },
  "honkbal_vangen": {
    "links": [
      0.029,
      1.43,
      0.067
    ],
    "rechts": [
      -0.252,
      1.006,
      0.423
    ],
    "confidence": "hoog"
  },
  "trefbal_gooien": {
    "links": [
      0.27,
      1.164,
      0.716
    ],
    "rechts": [
      -0.446,
      1.152,
      -0.389
    ],
    "confidence": "hoog"
  },
  "handbal": {
    "links": [
      0.69,
      1.084,
      0.374
    ],
    "rechts": [
      0.143,
      1.585,
      0.105
    ],
    "confidence": "hoog"
  },
  "korfbal": {
    "links": [
      0.123,
      1.059,
      0.228
    ],
    "rechts": [
      -0.279,
      1.037,
      -0.108
    ],
    "confidence": "hoog"
  },
  "basketbal_schot": {
    "links": [
      -0.072,
      1.464,
      -0.058
    ],
    "rechts": [
      -0.209,
      1.61,
      0.081
    ],
    "confidence": "hoog"
  },
  "tafeltennis": {
    "links": [
      0.256,
      0.89,
      0.13
    ],
    "rechts": [
      -0.412,
      0.919,
      0.073
    ],
    "confidence": "hoog"
  },
  "football_rennen": {
    "links": [
      0.335,
      0.923,
      -0.383
    ],
    "rechts": [
      -0.17,
      1.151,
      0.311
    ],
    "confidence": "hoog"
  },
  "football_passen": {
    "links": [
      0.77,
      1.439,
      0.052
    ],
    "rechts": [
      0.135,
      1.499,
      0.012
    ],
    "confidence": "hoog"
  },
  "rugby_tackle": {
    "links": [
      0.162,
      1.174,
      0.187
    ],
    "rechts": [
      0.118,
      0.59,
      0.168
    ],
    "confidence": "laag"
  },
  "tikspel": {
    "links": [
      0.575,
      0.808,
      0.2
    ],
    "rechts": [
      -0.635,
      0.273,
      -0.064
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
      0.452,
      1.239,
      -0.118
    ],
    "rechts": [
      0.019,
      1.408,
      -0.011
    ],
    "confidence": "hoog"
  },
  "startblokken": {
    "links": [
      0.368,
      0.008,
      0.5
    ],
    "rechts": [
      -0.388,
      0.01,
      0.489
    ],
    "confidence": "hoog"
  },
  "hoogspringen": {
    "links": [
      -0.015,
      0.819,
      0.836
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
      0.598,
      1.151,
      0.526
    ],
    "rechts": [
      -0.562,
      0.899,
      -0.362
    ],
    "confidence": "hoog"
  },
  "kogelstoten": {
    "links": [
      0.73,
      1.473,
      0.354
    ],
    "rechts": [
      -0.418,
      1.129,
      0.141
    ],
    "confidence": "hoog"
  },
  "speerwerpen": {
    "links": [
      -0.131,
      1.456,
      -0.03
    ],
    "rechts": [
      -0.621,
      1.256,
      -0.224
    ],
    "confidence": "hoog"
  },
  "speer_klaarstand": {
    "links": [
      0.129,
      0.919,
      0.182
    ],
    "rechts": [
      -0.385,
      1.109,
      0.015
    ],
    "confidence": "hoog"
  },
  "fietsband": {
    "links": [
      0.007,
      1.473,
      0.058
    ],
    "rechts": [
      -0.429,
      0.953,
      -0.07
    ],
    "confidence": "hoog"
  },
  "balanceren": {
    "links": [
      0.771,
      1.287,
      -0.008
    ],
    "rechts": [
      -0.871,
      1.288,
      0
    ],
    "confidence": "hoog"
  },
  "handstand": {
    "links": [
      0.167,
      1.498,
      -0.046
    ],
    "rechts": null,
    "confidence": "laag"
  },
  "salto": {
    "links": [
      -0.098,
      0.536,
      -0.223
    ],
    "rechts": [
      -0.291,
      0.178,
      -0.069
    ],
    "confidence": "hoog"
  },
  "landen": {
    "links": [
      0.748,
      1.349,
      0.156
    ],
    "rechts": [
      -0.749,
      1.353,
      0.162
    ],
    "confidence": "hoog"
  },
  "judo": {
    "links": [
      0.059,
      0.992,
      0.397
    ],
    "rechts": [
      -0.201,
      1.051,
      0.228
    ],
    "confidence": "hoog"
  },
  "judo_worp": {
    "links": [
      0.47,
      1.281,
      0.38
    ],
    "rechts": [
      -0.255,
      1.075,
      0.233
    ],
    "confidence": "hoog"
  },
  "judo_partij": {
    "links": [
      -0.203,
      0.934,
      0.36
    ],
    "rechts": [
      -0.284,
      1.351,
      0.056
    ],
    "confidence": "laag"
  },
  "bal_schieten": {
    "links": [
      0.41,
      0.87,
      0.397
    ],
    "rechts": [
      -0.743,
      1.008,
      -0.277
    ],
    "confidence": "hoog"
  }
};
