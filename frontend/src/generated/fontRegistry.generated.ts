// Generated from shared/font_registry.json. Do not edit.
export const FONT_REGISTRY = {
  "version": 1,
  "fallbacks": {
    "display": "Cormorant Garamond",
    "body": "Inter",
    "metadata": "JetBrains Mono"
  },
  "fonts": [
    {
      "family": "Cormorant Garamond",
      "category": "editorial_serif",
      "roles": [
        "display"
      ],
      "weights": [
        300,
        400,
        500,
        600
      ],
      "italics": true,
      "provider": "google"
    },
    {
      "family": "Playfair Display",
      "category": "high_contrast_serif",
      "roles": [
        "display"
      ],
      "weights": [
        400,
        500,
        600,
        700
      ],
      "italics": true,
      "provider": "google"
    },
    {
      "family": "Cinzel",
      "category": "high_contrast_serif",
      "roles": [
        "display"
      ],
      "weights": [
        400,
        600,
        700
      ],
      "italics": false,
      "provider": "google"
    },
    {
      "family": "Prata",
      "category": "high_contrast_serif",
      "roles": [
        "display"
      ],
      "weights": [
        400
      ],
      "italics": false,
      "provider": "google"
    },
    {
      "family": "Instrument Serif",
      "category": "editorial_serif",
      "roles": [
        "display"
      ],
      "weights": [
        400
      ],
      "italics": true,
      "provider": "google"
    },
    {
      "family": "Inter",
      "category": "neo_grotesque",
      "roles": [
        "body"
      ],
      "weights": [
        300,
        400,
        500,
        600,
        700
      ],
      "italics": false,
      "provider": "google"
    },
    {
      "family": "Plus Jakarta Sans",
      "category": "neo_grotesque",
      "roles": [
        "body"
      ],
      "weights": [
        400,
        500,
        600,
        700
      ],
      "italics": false,
      "provider": "google"
    },
    {
      "family": "Jost",
      "category": "neo_grotesque",
      "roles": [
        "body"
      ],
      "weights": [
        300,
        400,
        500,
        600
      ],
      "italics": false,
      "provider": "google"
    },
    {
      "family": "Space Grotesk",
      "category": "geometric_sans",
      "roles": [
        "display"
      ],
      "weights": [
        400,
        500,
        600,
        700
      ],
      "italics": false,
      "provider": "google"
    },
    {
      "family": "Outfit",
      "category": "geometric_sans",
      "roles": [
        "display"
      ],
      "weights": [
        300,
        400,
        500,
        600
      ],
      "italics": false,
      "provider": "google"
    },
    {
      "family": "Syne",
      "category": "geometric_sans",
      "roles": [
        "display"
      ],
      "weights": [
        400,
        600,
        700,
        800
      ],
      "italics": false,
      "provider": "google"
    },
    {
      "family": "Oswald",
      "category": "condensed_display",
      "roles": [
        "display"
      ],
      "weights": [
        400,
        500,
        600
      ],
      "italics": false,
      "provider": "google"
    },
    {
      "family": "Anton",
      "category": "condensed_display",
      "roles": [
        "display"
      ],
      "weights": [
        400
      ],
      "italics": false,
      "provider": "google"
    },
    {
      "family": "Bebas Neue",
      "category": "condensed_display",
      "roles": [
        "display"
      ],
      "weights": [
        400
      ],
      "italics": false,
      "provider": "google"
    },
    {
      "family": "JetBrains Mono",
      "category": "mono",
      "roles": [
        "metadata"
      ],
      "weights": [
        400,
        500,
        600,
        700
      ],
      "italics": false,
      "provider": "google"
    },
    {
      "family": "Space Mono",
      "category": "mono",
      "roles": [
        "metadata"
      ],
      "weights": [
        400,
        700
      ],
      "italics": false,
      "provider": "google"
    },
    {
      "family": "IBM Plex Mono",
      "category": "mono",
      "roles": [
        "metadata"
      ],
      "weights": [
        400,
        500,
        600,
        700
      ],
      "italics": false,
      "provider": "google"
    }
  ]
} as const;
export const ALL_VERIFIED_FONTS = FONT_REGISTRY.fonts.map(font => font.family);
