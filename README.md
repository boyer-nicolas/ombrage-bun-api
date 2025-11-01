# [Ombrage API](https://www.npmjs.com/package/ombrage-bun-api)

[![CI](https://github.com/boyer-nicolas/ombrage-bun-api/actions/workflows/publish.yaml/badge.svg)](https://github.com/boyer-nicolas/ombrage-bun-api/actions/workflows/publish.yaml)
[![NPM Version](https://img.shields.io/npm/v/ombrage-bun-api)](https://www.npmjs.com/package/ombrage-bun-api)
[![NPM Downloads](https://img.shields.io/npm/dm/ombrage-bun-api)](https://www.npmjs.com/package/ombrage-bun-api)
[![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen)](./coverage/)

A powerful file-based routing system built with Bun, featuring automatic API documentation generation with Swagger UI.

## Features

- 🚀 **File-based routing**: Routes auto-discovered from filesystem structure
- 📁 **Structured organization**: A simple `route.ts` file
- 📖 **Auto-generated docs**: Swagger UI with OpenAPI 3.0 specifications
- 🔄 **Hot reload**: Development server with instant updates
- 🛡️ **JSON error responses**: Consistent error handling with structured responses

## Getting Started

1. Install the package

```bash
bun install ombrage-bun-api
```

2. Create the server entry point

```typescript
// index.ts
import { Server } from "ombrage-bun-api";

new Server("./routes").start();
```

3. Create your first route

```typescript
// routes/hello/route.ts
import { createRoute } from "ombrage-bun-api/helpers";
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
   import { createRoute } from "ombrage-bun-api";
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
    profile/
      route.ts
```

### Parameter Definition

Use Zod schemas to define route parameters in your route specs. Ombrage API supports three types of parameters that are automatically extracted and validated:

```typescript
export const GET = createRoute({
  method: "GET",
  callback: async ({ params, query, request }) => {
    // Path parameters
    const { id } = params; // From /users/[id]

    // Query parameters (with defaults applied)
    const { limit, offset, search } = query;

    // Use parameters in your logic
    const users = await getUsersWithFilters({
      id,
      limit,
      offset,
      search,
    });

    return Response.json(users);
  },
  spec: {
    summary: "Get user by ID with optional filters",
    parameters: z.object({
      // Path parameters (from dynamic routes like [id])
      path: z.object({
        id: z.string().describe("The unique user identifier"),
        categoryId: z.string().optional().describe("Optional category filter"),
      }),

      // Query parameters (?limit=10&offset=0&search=john)
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
        active: z.boolean().default(true).describe("Filter by active status"),
      }),
    }),
    responses: {
      "200": {
        description: "User data with filters applied",
        // ... response schema
      },
    },
  },
});
```

#### Parameter Types

| Parameter Type | Location         | Example                 | Description                      |
| -------------- | ---------------- | ----------------------- | -------------------------------- |
| **Path**       | URL segments     | `/users/[id]`           | Dynamic route segments           |
| **Query**      | URL query string | `?limit=10&search=john` | Optional filters and pagination  |
| **Headers**    | HTTP headers     | `accept-language: en`   | Content negotiation and metadata |

#### Accessing Parameters in Routes

Parameters are automatically parsed and provided to your route handlers:

```typescript
export const GET = createRoute({
  method: "GET",
  callback: async ({ params, query, headers, request }) => {
    // Path parameters
    const { id } = params; // From /users/[id]

    // Query parameters (with defaults applied)
    const { limit, offset, search } = query;

    // Headers
    const apiKey = headers["x-api-key"];

    // Use parameters in your logic
    const users = await getUsersWithFilters({
      id,
      limit,
      offset,
      search,
      apiKey,
    });

    return Response.json(users);
  },
  spec: spec.get,
});
```

### Supported Parameter Types & Validation

Ombrage API automatically converts Zod schemas to OpenAPI parameter definitions and provides runtime validation:

#### Basic Types

```typescript
z.string(); // String parameter
z.number(); // Numeric parameter
z.boolean(); // Boolean parameter (true/false)
z.date(); // Date parameter (ISO string)
```

#### Advanced Types

```typescript
// Enums with specific values
z.enum(["active", "inactive", "pending"]);

// Arrays (query: ?tags=frontend,backend,api)
z.array(z.string());

// Optional parameters
z.string().optional();

// Parameters with default values
z.number().default(10);

// Parameters with validation
z.string().min(3).max(50);
z.number().min(1).max(100);
z.string().email();
z.string().uuid();

// Parameters with descriptions (for OpenAPI docs)
// Parameters with descriptions (for OpenAPI docs)
z.string().describe("User's unique identifier");
```

#### Type Coercion & Validation

The framework automatically:

- **Converts types**: Strings to numbers, "true"/"false" to booleans
- **Validates constraints**: Min/max values, string patterns, required fields
- **Applies defaults**: Missing optional parameters get default values
- **Generates errors**: Returns 400 Bad Request for invalid parameters

```typescript
// Example with comprehensive validation
query: z.object({
  page: z.number().min(1).default(1).describe("Page number"),
  size: z.number().min(10).max(100).default(20).describe("Items per page"),
  sort: z.enum(["name", "date", "popularity"]).default("name"),
  filter: z.string().min(2).optional().describe("Search filter"),
  active: z.boolean().default(true),
  tags: z.array(z.string()).optional(),
});
```

#### Error Handling

When parameter validation fails, the framework automatically returns structured error responses:

```json
{
  "error": "Parameter validation failed",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "type": "number",
      "inclusive": true,
      "exact": false,
      "message": "Number must be greater than or equal to 1",
      "path": ["query", "page"]
    }
  ]
}
```

### Complete Example: Advanced Route with Parameters

```typescript
// routes/users/[id]/route.ts
import { createRoute } from "ombrage-bun-api";
```

#### Type Coercion & Validation

The framework automatically:

- **Converts types**: Strings to numbers, "true"/"false" to booleans
- **Validates constraints**: Min/max values, string patterns, required fields
- **Applies defaults**: Missing optional parameters get default values
- **Generates errors**: Returns 400 Bad Request for invalid parameters

```typescript
// Example with comprehensive validation
query: z.object({
  page: z.number().min(1).default(1).describe("Page number"),
  size: z.number().min(10).max(100).default(20).describe("Items per page"),
  sort: z.enum(["name", "date", "popularity"]).default("name"),
  filter: z.string().min(2).optional().describe("Search filter"),
  active: z.boolean().default(true),
  tags: z.array(z.string()).optional(),
});
```

})

#### Error Handling

When parameter validation fails, the framework automatically returns structured error responses:

```json
{
  "error": "Parameter validation failed",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "type": "number",
      "inclusive": true,
      "exact": false,
      "message": "Number must be greater than or equal to 1",
      "path": ["query", "page"]
    }
  ]
}
```

````typescript
```typescript
export const GET = createRoute({
  method: "GET",
  callback: async ({ params, query }) => {
    // All parameters are typed and validated
    const { id } = params; // string (required)
    const { include, limit } = query; // string[] | undefined, number

    try {
      const user = await getUserById(id, {
        include,
        limit,
      });

      return Response.json(user);
    } catch (error) {
      if (error.code === "USER_NOT_FOUND") {
        return Response.json({ error: "User not found" }, { status: 404 });
      }
      throw error; // Let framework handle other errors
    }
  },
  spec: {
    summary: "Get user by ID with optional includes",
    description: "Retrieve a specific user with optional related data",
    parameters: z.object({
      path: z.object({
        id: z.string().uuid().describe("User's UUID"),
      }),
      query: z.object({
        include: z
          .array(z.enum(["profile", "posts", "followers"]))
          .optional()
          .describe("Related data to include"),
        limit: z
          .number()
          .min(1)
          .max(50)
          .default(10)
          .describe("Limit for included items"),
      }),
    }),
    responses: {
      "200": {
        description: "User data successfully retrieved",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string" },
                email: { type: "string", format: "email" },
                profile: { type: "object" },
                posts: { type: "array" },
                followers: { type: "array" },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid parameters",
      },
      "404": {
        description: "User not found",
      },
    },
  },
});
````

#### Best Practices for Parameter Definition

1. **Always provide descriptions** for clear API documentation:

   ```typescript
   id: z.string().uuid().describe("User's unique identifier");
   ```

2. **Use appropriate validation** for data integrity:

   ```typescript
   email: z.string().email().describe("User's email address");
   limit: z.number().min(1).max(100).describe("Results per page");
   ```

3. **Provide sensible defaults** for optional parameters:

   ```typescript
   page: z.number().min(1).default(1);
   sortOrder: z.enum(["asc", "desc"]).default("asc");
   ```

4. **Group related parameters** logically:

   ```typescript
   parameters: z.object({
     path: z.object({
       /* path params */
     }),
     query: z.object({
       /* query params */
     }),
     headers: z.object({
       /* headers */
     }),
   });
   ```

5. **Use enums for controlled values** instead of free-form strings:
   ```typescript
   status: z.enum(["active", "inactive", "suspended"]);
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

The coverage badge in this README is automatically updated on every push to the main branch as part of the publish workflow.

## Publishing

The package is automatically published to NPM when changes are pushed to the `main` branch.

### Automated Publishing (Recommended)

1. **Push to main branch**: The publish workflow automatically handles everything
2. **Coverage updates**: Updates coverage badge and generates reports
3. **Changelog generation**: Uses `changelogen` to generate changelog and bump version
4. **NPM publishing**: Publishes to NPM with public access
5. **GitHub releases**: Creates GitHub releases with generated release notes

The workflow intelligently:

- Skips publishing if only coverage badge updates (marked with `[skip ci]`)
- Updates coverage badges on every run
- Only publishes when there are actual code changes since the last release

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
