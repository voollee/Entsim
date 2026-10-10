import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
export default defineConfig({
  root: "apps/widget",
  plugins: [viteSingleFile()],
  build: { outDir: "../../dist", emptyOutDir: true, target: "es2022" },
  server: {
    proxy: {
      "/v1": "http://localhost:3000",
      "/dev-config": "http://localhost:3000",
    },
  },
});
