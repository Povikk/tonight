import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Tests unitaires du parser et du moteur de recommandation.
 * Ces deux briques doivent rester testables SANS interface : c'est la condition
 * pour pouvoir les faire évoluer sans casser l'application (§66, §70, §71).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
