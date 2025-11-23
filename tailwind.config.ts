import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Hệ màu brand giống CBME Atlas
        brand: {
          50:  "#ECFDF5",
          100: "#D1FAE5",
          200: "#A7F3D0",
          300: "#6EE7B7",
          400: "#34D399",
          500: "#10B981",
          600: "#059669", // primary
          700: "#047857", // hover
          800: "#065F46",
          900: "#064E3B",

          // Alias để dùng class kiểu bg-brand-primary, text-brand-secondary...
          primary:   "#059669",
          secondary: "#f5c518",
          accent:    "#10B981",
          muted:     "#6b7280",
          neutral:   "#111827",
        },
      },
      boxShadow: {
        soft: "0 8px 24px rgba(0,0,0,0.08)",
      },
      borderRadius: {
        "2xl": "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
