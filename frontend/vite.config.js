import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        "/api": "http://localhost:8000",
      },
      headers: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      fs: { allow: [".."] },
    },
});
