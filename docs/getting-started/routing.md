# Routing Guide

The Ombrage Bun API uses a **file-based routing system** that automatically maps your file structure to API endpoints.

## Basic Route Structure

Each route is defined in a `route.ts` file within the `routes/` directory:

```typescript
import { createRoute } from "ombrage-bun-api";
import { z } from "zod";

export const GET = createRoute({
  method: "GET",
  handler: async ({ params, query, body, headers }) => {
    return Response.json({ message: "Hello World!" });
  },
  spec: {
    format: "json",
    tags: ["Users"],
    summary: "Get user data",
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

## Dynamic Routes

Use `[param]` folder syntax for dynamic route parameters:

```
routes/
├── users/
│   ├── route.ts              # GET /users
│   └── [id]/
│       └── route.ts          # GET /users/:id
└── posts/
    └── [slug]/
        ├── route.ts          # GET /posts/:slug
        └── comments/
            └── route.ts      # GET /posts/:slug/comments
```

## HTTP Methods

Export different HTTP methods from the same route file:

```typescript
export const GET = createRoute({
  /* ... */
});
export const POST = createRoute({
  /* ... */
});
export const PUT = createRoute({
  /* ... */
});
export const DELETE = createRoute({
  /* ... */
});
```

## Route Discovery

The router automatically:

1. Scans the `routes/` directory recursively
2. Only processes `route.ts` files (not `index.ts`)
3. Matches routes in order: exact → dynamic → prefix
4. Converts `[param]` to URL parameters

## Best Practices

- Keep routes focused and single-purpose
- Use descriptive folder names
- Group related endpoints in subdirectories
- Leverage TypeScript for type safety
