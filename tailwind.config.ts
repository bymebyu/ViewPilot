import type { Config } from "tailwindcss";

export default {
  content: ["./entrypoints/**/*.{html,tsx,ts}", "./components/**/*.{tsx,ts}"],
  darkMode: "class",
  theme: {
    extend: {
      keyframes: {
        "cursor-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "typing-dot": {
          "0%, 60%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "30%": { transform: "translateY(-4px)", opacity: "1" },
        },
      },
      animation: {
        "cursor-blink": "cursor-blink 0.9s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.18s ease-out",
        "typing-dot": "typing-dot 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
