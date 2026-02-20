import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import html from "@elysiajs/html";
import { pageRoutes } from "./route/pages";
import { apiRoutes } from "./route/api";
import openapi from "@elysiajs/openapi";

const app = new Elysia()
  .use(openapi())
  .use(html())
  .use(
    staticPlugin({
      assets: "public",
      prefix: "/",
    }),
  )
  .use(pageRoutes)
  .use(apiRoutes)
  .listen(Number(process.env.PORT) || 3000);

console.log(`⚒️  QR Forge is running at http://localhost:${app.server?.port}`);

export type App = typeof app;
