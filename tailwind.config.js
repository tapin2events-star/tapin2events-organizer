/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Remapped to match the real TapIN2Events (Base44) app's actual palette:
      // a light shadcn/ui theme (white cards, gray-900 text, indigo accents)
      // rather than the dark ticket-stub concept this app started with.
      colors: {
        ink: "#FFFFFF",       // page background
        surface: "#FFFFFF",   // card background
        surface2: "#F9FAFB",  // input / secondary fill
        marigold: "#4F46E5",  // primary action (was orange -> now indigo-600)
        magenta: "#DC2626",   // destructive/error (now red-600)
        mint: "#16A34A",      // success (now green-600)
        bone: "#111827",      // primary text (now near-black, gray-900)
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
