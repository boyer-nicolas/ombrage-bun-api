# [Ombrage API](https://www.npmjs.com/package/ombrage-api)

[![CI](https://github.com/boyer-nicolas/ombrage-api/actions/workflows/ci.yaml/badge.svg)](https://github.com/boyer-nicolas/ombrage-api/actions/workflows/ci.yaml)
[![Publish](https://github.com/boyer-nicolas/ombrage-api/actions/workflows/publish.yaml/badge.svg)](https://github.com/boyer-nicolas/ombrage-api/actions/workflows/publish.yaml)
[![NPM Version](https://img.shields.io/npm/v/ombrage-api)](https://www.npmjs.com/package/ombrage-api)
[![NPM Downloads](https://img.shields.io/npm/dm/ombrage-api)](https://www.npmjs.com/package/ombrage-api)
[![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen)](./coverage/)

A powerful file-based routing system built with Bun, featuring automatic API documentation generation with Swagger UI.

## Features

- 🚀 **File-based routing**: Routes auto-discovered from filesystem structure
- 📁 **Structured organization**: Separate `route.ts` and `spec.ts` files
- 📖 **Auto-generated docs**: Swagger UI with OpenAPI 3.0 specifications
- 🔄 **Hot reload**: Development server with instant updates
- 🛡️ **JSON error responses**: Consistent error handling with structured responses

## Getting Started

1. Install the package

```bash
bun install ombrage-api
```

2. Create the server entry point

```typescript
// index.ts
import { Server } from "ombrage-api";

new Server("./routes").start();
```

3. Create your first route

```typescript
// routes/hello/route.ts
import { createRoute } from "ombrage-api/helpers";
export const GET = createRoute({
  method: "GET",
  callback: async () => {
    return Response.json({ message: "Hello, world!" });
  },
});
```

4. Run the server

```bash
bun run index.ts
```

## API Documentation

Once the server is running, visit:

- **Swagger UI**: http://localhost:8080
- **OpenAPI JSON**: http://localhost:8080/api-docs.json
- **Health Check**: http://localhost:8080/healthz

## Creating Routes

1. **Create a directory** under `routes/` (e.g., `routes/users/profile/`)
2. **Add route handlers** in `route.ts`:

   ```typescript
   import { createRoute } from "ombrage-api";
   import { getProfile, profileSchema } from "../lib/service";
   import { z } from "zod";

   export const GET = createRoute({
     method: "GET",
     callback: async () => {
       const profile = await getProfile();
       return Response.json(profile);
     },
     spec: {
      format: "json",
      responses: {
        200: {
          summary: "User Profile",
          description: "User profile retrieved successfully",
          schema: profileSchema, // Zod schema for automatic documentation
      }
     },
   });
   ```

3. **Add business logic** in `../lib/service.ts`:

   ```typescript
   import { z } from "zod";

   export const profileSchema = z.object({
     id: z.number().description("User ID"),
     name: z.string().description("User name"),
   });

   export type Profile = z.infer<typeof profileSchema>;

   export async function getProfile(): Profile {
     return { id: 1, name: "John Doe" };
   }
   ```

The route will be automatically available at `/users/profile` with full Swagger documentation!

## Route Parameters with Zod

Ombrage API supports dynamic routes with parameters using Zod schemas for type safety and automatic documentation generation.

### Dynamic Routes

Create dynamic routes using bracket notation in folder names:

```
routes/
  users/
    [id]/
      route.ts
      spec.ts
    profile/
      route.ts
      spec.ts
```

### Parameter Definition

Use Zod schemas to define route parameters in your `spec.ts` files:

```typescript
import { defineSpec } from "ombrage-api";
import { z } from "zod";

export default defineSpec({
  get: {
    summary: "Get user by ID",
    parameters: z.object({
      id: z.string().describe("The unique user identifier"),
    }),
    responses: {
      "200": {
        description: "User data",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                email: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
});
```

### Parameter Types

Define different parameter types using nested Zod objects:

```typescript
import { z } from "zod";

export default defineSpec({
  get: {
    summary: "Search users with filters",
    parameters: z.object({
      // Path parameters (from dynamic routes like [id])
      path: z.object({
        categoryId: z.string().describe("Category identifier"),
      }),

      // Query parameters (?limit=10&offset=0)
      query: z.object({
        limit: z
          .number()
          .min(1)
          .max(100)
          .default(10)
          .describe("Number of results to return"),
        offset: z
          .number()
          .min(0)
          .default(0)
          .describe("Number of results to skip"),
        search: z.string().optional().describe("Search term to filter users"),
      }),

      // Header parameters
      headers: z.object({
        "x-api-key": z.string().describe("API authentication key"),
      }),
    }),
    responses: {
      "200": {
        description: "List of users",
        // ... response schema
      },
    },
  },
});
```

### Supported Parameter Types

Ombrage API automatically converts Zod schemas to OpenAPI parameter definitions:

- **String**: `z.string()`
- **Number**: `z.number()`
- **Boolean**: `z.boolean()`
- **Date**: `z.date()`
- **Enum**: `z.enum(["value1", "value2"])`
- **Array**: `z.array(z.string())`
- **Optional**: `.optional()`
- **Default values**: `.default(value)`
- **Descriptions**: `.describe("Parameter description")`

### Example: Complete Route with Parameters

```typescript
// routes/storage/[id]/route.ts
import { createRoute } from "ombrage-api";
import spec from "./spec";

export const GET = createRoute({
  method: "GET",
  callback: async ({ params }) => {
    const { id } = params; // TypeScript knows this is a string
    // Fetch and return storage data
    return Response.json({ id, data: "storage content" });
  },
  spec: spec.get,
});
```

```typescript
// routes/storage/[id]/spec.ts
import { defineSpec } from "ombrage-api";
import { z } from "zod";

export default defineSpec({
  get: {
    summary: "Get storage bucket by ID",
    parameters: z.object({
      id: z.string().describe("The bucket ID"),
    }),
    responses: {
      "200": {
        description: "Storage bucket data",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                id: { type: "string" },
                data: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
});
```

The framework automatically:

- Extracts the `id` parameter from the URL path
- Validates it against the Zod schema
- Generates OpenAPI documentation with proper parameter definitions
- Provides type-safe access in your route handlers

## Environment Variables

[See Environment Variables Documentation](./env.md)

## Development & Testing

### Running Tests

```bash
bun test
```

### Coverage Reports

The project automatically generates coverage reports during testing. You can:

- **View HTML Coverage Report**: Open `coverage/index.html` in your browser after running tests
- **Generate Coverage Badge**: Run `bun run coverage:badge` to update the README badge
- **Generate Coverage Report**: Run `bun run coverage:report` to create the HTML report

The coverage badge in this README is automatically updated on every push to the main branch via GitHub Actions.

## Publishing

The package is automatically published to NPM when changes are pushed to the `main` branch.

### Automated Publishing (Recommended)

1. **Push to main branch**: The CI/CD pipeline automatically handles publishing
2. **Changelog generation**: Uses `changelogen` to generate changelog and bump version
3. **NPM publishing**: Publishes to NPM with public access
4. **GitHub releases**: Creates GitHub releases with generated release notes

### Manual Publishing

For local testing or manual releases:

```bash
# Run all checks and publish locally
bun run publish:local

# Or use the original publish script
bun run publish
```

### Setup Requirements

To enable automated publishing, configure these GitHub repository secrets:

- `NPM_TOKEN`: Your NPM authentication token with publish permissions

**To create an NPM token:**

1. Log in to [npmjs.com](https://www.npmjs.com)
2. Go to Access Tokens in your account settings
3. Generate a new token with "Automation" type
4. Add it as `NPM_TOKEN` in your GitHub repository secrets
