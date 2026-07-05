import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` has no resolvable module under a plain Node (vitest)
      // environment — it relies on a bundler export condition. Alias it to an
      // empty stub so server-only modules can be unit-tested. The real
      // production guarantee (build failure if imported client-side) is
      // unaffected — this alias applies to the test runner only.
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
