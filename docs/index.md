---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Koritsu"
  text: "A File-based routing API framework"
  tagline: Built with Bun, featuring automatic OpenAPI documentation generation
  actions:
    - theme: brand
      text: Getting Started
      link: /getting-started/getting-started
    - theme: alt
      text: Examples
      link: /examples-patterns/examples

features:
  - title: 🚀 File-based Routing
    details: Routes are auto-discovered from your filesystem structure. Simply create a route.ts file and your endpoint is ready.
  - title: 📖 Auto-generated Docs
    details: Swagger UI and OpenAPI 3.1 specifications are automatically generated from your route definitions and Zod schemas.
  - title: 🛡️ Type-safe Validation
    details: Built with TypeScript and Zod for runtime validation, type safety, and excellent developer experience.
---

<div style="display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin: 2rem 0; flex-wrap: wrap;">
  <img src="https://img.shields.io/npm/v/koritsu?style=for-the-badge&logo=npm&logoColor=white&label=Latest&color=8e5cd9" alt="NPM Version">
  <img src="https://img.shields.io/npm/dm/koritsu?style=for-the-badge&logo=npm&color=8e5cd9" alt="NPM Downloads">
  <img src="https://img.shields.io/github/license/boyer-nicolas/koritsu?style=for-the-badge&color=8e5cd9" alt="License">
</div>

<br/>

# Quick Start

1. **Install the package**

```bash
bun install koritsu
```

2. **Create the server entry point**

```typescript
// index.ts
import { Api } from "koritsu";

new Api({
  server: {
    routes: {
      dir: "./routes", // Directory containing your route files
    },
  },
}).start();
```

3. **Create your first route**

```typescript
// routes/hello/route.ts
import { createRoute } from "koritsu";
import { z } from "zod";

export const GET = createRoute({
  method: "GET",
  handler: async () => {
    return Response.json({ message: "Hello, world!" });
  },
  spec: {
    format: "json",
    summary: "Hello World",
    responses: {
      200: {
        schema: z.object({
          message: z.string(),
        }),
      },
    },
  },
});
```

4. **Run the server**

```bash
bun run index.ts
```

Visit [http://localhost:8080](http://localhost:8080) to see your API documentation!
