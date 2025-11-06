# Better Auth Integration

This guide demonstrates how to integrate [Better Auth](https://www.better-auth.com/) with your Ombrage Bun API for comprehensive authentication and session management.

For complete Better Auth documentation, features, and configuration options, visit the [official Better Auth documentation](https://www.better-auth.com/docs).

When integrated with Ombrage, Better Auth routes are handled through the [proxy system](/core-concepts/proxy), allowing seamless authentication alongside your API routes.

> **Note**: This guide uses SQLite with `bun:sqlite` as an example, but Better Auth works with any database system supported by Drizzle ORM (PostgreSQL, MySQL, SQLite, etc.). Simply adjust the database driver and connection configuration for your chosen database.

## Quick Start

A complete working example is available in the [packages/examples/auth](https://github.com/boyer-nicolas/ombrage-bun-api/tree/main/packages/examples/auth) directory of the Ombrage repository. This example includes:

- Full Better Auth integration
- Database setup with automatic schema generation
- OpenAPI documentation generation

You can use this as a starting point for your own authentication implementation.

## Installation

### 1. Init the project

```bash
bun init -y
```

### 2. Install the required dependencies:

```bash
bun add better-auth drizzle-orm
bun add -d drizzle-kit @types/better-auth
```

## Folder structure setup

Let's create a lib directory in which we'll be able to store our database and authentication configuration files.

```bash
mkdir -p lib/db
```

## Database Setup

### 1. Configure Database Connection

```typescript
// lib/db/index.ts
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

const sqlite = new Database("sqlite.db");
export const db = drizzle({ client: sqlite });
```

### 2. Generate Database Schema

Better Auth can automatically generate the required database schema:

```bash
# Will prompt to save the schema file as auth-schema.ts, say yes.
bunx --bun @better-auth/cli generate

# Move the generated schema to the correct location
mv auth-schema.ts lib/db/schema.ts
```

### 3. Run drizzle generation

```bash
bunx --bun drizzle-kit generate
```

## Better Auth Configuration

Create your Better Auth instance:

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { db } from "./db";
import * as schema from "./db/schema";

export const auth = betterAuth({
  basePath: "/auth",
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    openAPI({
      path: "/openapi",
    }),
  ],
});
```

## Ombrage Integration

Integrate Better Auth with your Ombrage API using the proxy system. You can handle authentication directly in the proxy handler for protected routes:

```typescript
// index.ts
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Api } from "ombrage-bun-api";
import { auth } from "./lib/auth";
import { db } from "./lib/db";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMigrations() {
  console.info("Migrating database...");
  let retries = 10;
  while (retries > 0) {
    try {
      console.info(`Running migrations (retries left: ${retries})`);
      migrate(db, {
        migrationsFolder: "drizzle/",
      });
      console.info("Database migrated successfully.");
      return;
    } catch (error) {
      console.error(
        `Database connection failed. Retrying... (${retries} attempts left)`
      );
      if (retries === 1) {
        console.error("Could not connect to the database. Exiting.");
        console.error(error);
        process.exit(1);
      }
      retries -= 1;
      await sleep(300);
    }
  }
}

const server = new Api({
  title: "Example Auth API",
  description: "API with Better Auth integration",
  server: {
    routes: {
      dir: "./routes",
    },
  },
  swagger: {
    enabled: true,
    path: "/",
    // Unified OpenAPI documentation
    externalSpecs: [
      {
        url: "http://localhost:8080/auth/openapi",
        name: "better-auth",
        tags: ["Authentication"],
      },
    ],
  },
  proxy: {
    enabled: true,
    configs: [
      {
        pattern: "/auth/**",
        description: "Authentication endpoints handled by better-auth",
        handler: async ({ request }) => {
          console.log(`[AUTH] ${request.method} ${request.url}`);

          try {
            const response = await auth.handler(request);

            if (response) {
              return {
                proceed: false,
                response,
              };
            }

            return {
              proceed: false,
              response: new Response("Auth endpoint not found", {
                status: 404,
              }),
            };
          } catch (error) {
            console.error("[AUTH] Error handling request:", error);
            return {
              proceed: false,
              response: new Response("Internal auth error", { status: 500 }),
            };
          }
        },
      },
      {
        pattern: "/protected/**",
        description: "Protected routes requiring authentication",
        handler: async ({ request }) => {
          try {
            // Validate session before proceeding to route handlers
            const session = await auth.api.getSession({
              headers: request.headers,
            });

            if (!session) {
              return {
                proceed: false,
                response: new Response("Unauthorized", { status: 401 }),
              };
            }

            // Add user info to request headers for route handlers to use
            const headers = new Headers(request.headers);
            headers.set("x-user-id", session.user.id);
            headers.set("x-user-email", session.user.email);
            headers.set("x-user-name", session.user.name || "");

            // Create new request with user info
            const authenticatedRequest = new Request(request.url, {
              method: request.method,
              headers,
              body: request.body,
            });

            return {
              proceed: true, // Continue to route handlers
              request: authenticatedRequest,
            };
          } catch (error) {
            console.error("[AUTH] Session validation error:", error);
            return {
              proceed: false,
              response: new Response("Invalid session", { status: 401 }),
            };
          }
        },
      },
    ],
  },
});

await runMigrations();

server.start();
```

## Protecting Routes

With the proxy configuration above, any route under `/protected/` will automatically require authentication. Your route handlers can access user information from the request headers:

```typescript
// routes/protected/profile/route.ts
import { createRoute } from "ombrage-bun-api";
import { z } from "zod";

export const GET = createRoute({
  method: "GET",
  handler: async ({ request }) => {
    // User info is already validated and available in headers
    const userId = request.headers.get("x-user-id");
    const userEmail = request.headers.get("x-user-email");
    const userName = request.headers.get("x-user-name");

    return Response.json({
      message: `Hello, ${userName}!`,
      user: {
        id: userId,
        email: userEmail,
        name: userName,
      },
    });
  },
  spec: {
    format: "json",
    tags: ["Protected"],
    summary: "Get user profile",
    responses: {
      200: {
        schema: z.object({
          message: z.string(),
          user: z.object({
            id: z.string(),
            email: z.string(),
            name: z.string(),
          }),
        }),
      },
      401: {
        schema: z.object({
          error: z.string(),
        }),
      },
    },
  },
});
```

### Optional: Route-Level Authentication

For more granular control, you can also create a middleware function for specific routes:

```typescript
// lib/middleware.ts
import { auth } from "./auth";

export async function requireAuth(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    return { user: session.user, session: session.session };
  } catch (error) {
    return new Response("Invalid session", { status: 401 });
  }
}
```

Use this for routes that need authentication but aren't under the `/protected/` path:

```typescript
// routes/admin/route.ts
import { createRoute } from "ombrage-bun-api";
import { requireAuth } from "../../lib/middleware";
import { z } from "zod";

export const GET = createRoute({
  method: "GET",
  handler: async ({ request }) => {
    // Check authentication manually for this specific route
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user } = authResult;

    return Response.json({
      message: "Admin access granted",
      user: user,
    });
  },
  spec: {
    format: "json",
    tags: ["Admin"],
    summary: "Admin endpoint",
    responses: {
      200: {
        schema: z.object({
          message: z.string(),
          user: z.object({
            id: z.string(),
            email: z.string(),
            name: z.string(),
          }),
        }),
      },
      401: {
        schema: z.object({
          error: z.string(),
        }),
      },
    },
  },
});
```

## Unified OpenAPI Documentation

The `externalSpecs` configuration in the Swagger settings automatically merges Better Auth's comprehensive OpenAPI specification with your main API documentation. This integration provides:

### Single Documentation Source

All endpoints (your routes + Better Auth) are unified in one Swagger UI interface. Instead of having separate documentation for authentication endpoints, everything is accessible from your main API documentation.

### Consistent Schemas

Better Auth's schemas (User, Session, Account, Verification) become available throughout your API documentation, ensuring consistency across your entire API surface.

### Integrated Security

Better Auth's authentication schemes (cookie-based `apiKeyCookie` and `bearerAuth`) are automatically integrated into your OpenAPI spec, providing proper security documentation.

### Custom Tagging

The `tags: ["Authentication"]` configuration groups all Better Auth endpoints under a custom tag in your Swagger UI, making it easy to organize and navigate the documentation.

### How It Works

The external specs feature supports both JSON and HTML responses from OpenAPI endpoints. When Better Auth serves its OpenAPI spec as an HTML page with embedded JSON (which is the default), Ombrage automatically extracts the JSON specification and merges it with your main API documentation.

The merge process handles:

- **Paths**: All Better Auth routes (`/sign-in/email`, `/get-session`, etc.) appear alongside your routes
- **Components**: Schemas and security schemes are merged into your main spec
- **Tags**: Custom or existing tags are preserved and organized
- **Security**: Authentication requirements are properly documented

This means developers working with your API get complete documentation in one place, with authentication flows clearly documented alongside your business logic endpoints.
