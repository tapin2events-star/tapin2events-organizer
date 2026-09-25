import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        heartBurst: {
          '0%': { transform: 'translate(-50%, -50%) scale(0)', opacity: '0' },
          '15%': { transform: 'translate(-50%, -50%) scale(1.2)', opacity: '1' },
          '30%': { transform: 'translate(-50%, -50%) scale(1)', opacity: '1' },
          '100%': { transform: 'translate(-50%, -50%) scale(1)', opacity: '0' },
        },
      },
      animation: {
        'heart-burst': 'heartBurst 0.8s ease-out forwards',
      },
      // Remapped to match the real TapIN2Events (Base44) app's actual palette:
      // a light shadcn/ui theme (white cards, gray-900 text, indigo accents)
      // rather than the dark ticket-stub concept this app started with.
      colors: {
        ink: "#F5F5FB",       // page background -- soft lavender tint, not pure white
        surface: "#FFFFFF",   // card background
        surface2: "#F9FAFB",  // input / secondary fill
        marigold: "#4F46E5",  // primary action / brand gradient start (indigo)
        // teal/purple/pink keep Tailwind's full shade scales (teal-50, purple-100,
        // pink-500, ...) and add the brand color as the plain `teal`/`purple`/`pink`.
        // Defining them as single values used to wipe out every shade silently.
        teal: { ...colors.teal, DEFAULT: "#14B8A6" },      // brand gradient end (paired with marigold) -- distinct from mint
        purple: { ...colors.purple, DEFAULT: "#9333EA" },  // secondary "resources/featured" gradient start
        pink: { ...colors.pink, DEFAULT: "#EC4899" },      // secondary "resources/featured" gradient end
        magenta: "#DC2626",   // destructive/error (kept as-is, despite the name -- this is red)
        mint: "#16A34A",      // success/confirmed state (kept as a true green, distinct from teal)
        bone: "#111827",      // primary text (near-black, gray-900)
        muted: "#6B7280",     // secondary text (gray-500)
      },
      fontFamily: {
        // Base44 uses the plain system font stack, no custom display font.
        display: ["ui-sans-serif", "system-ui", "sans-serif"],
        body: ["ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
