# OpenAPI Integration

Ombrage Bun API automatically generates OpenAPI (Swagger) documentation from your route specifications.

## Automatic Documentation

Every route spec contributes to the generated OpenAPI schema:

```typescript
export const GET = createRoute({
  method: "GET",
  handler: async ({ params }) => {
    // Route implementation
  },
  spec: {
    format: "json",
    tags: ["Users"],
    summary: "Get user by ID",
    parameters: {
      path: z.object({
        id: z.string().uuid().describe("User ID"),
      }),
    },
    responses: {
      200: {
        schema: userSchema.describe("User data"),
      },
      404: {
        schema: errorSchema.describe("User not found"),
      },
    },
  },
});
```

## Swagger UI

Access the interactive documentation at:

- **Swagger UI**: `http://localhost:3000/` (configurable)
- **OpenAPI JSON**: `http://localhost:3000/api-docs.json`

## Zod Schema Conversion

The system automatically converts Zod schemas to OpenAPI JSON Schema:

```typescript
// Complex nested schema
const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(["admin", "user"]),
  metadata: z.record(z.string()).optional(),
  createdAt: z.date().transform((d) => d.toISOString()),
});

// Automatically becomes proper OpenAPI schema
```

## Configuration

Customize the documentation generation:

```typescript
new Api({
  title: "My API",
  description: "A powerful API built with Ombrage",
  version: "1.0.0",
  swagger: {
    path: "/docs", // Custom Swagger UI path
    enabled: true, // Enable/disable in production
  },
});
```

## Tags and Organization

Use tags to group related operations in the Swagger UI:

```typescript
spec: {
  tags: ["Users", "Authentication"],
  // ... other spec properties
}
```

Tags are automatically collected and added to the OpenAPI specification.

### OpenAPI Groups with Tags

Organize your API operations into logical groups using OpenAPI tags. Tags help categorize operations in the Swagger UI and make your API documentation more organized and user-friendly.

#### Adding Tags to Routes

Add the optional `tags` array to your route specification:

```typescript
export const GET = createRoute({
  method: "GET",
  handler: async () => {
    // Route logic here
    return Response.json({ message: "Success" });
  },
  spec: {
    format: "json",
    tags: ["Users", "Authentication"], // Multiple tags supported
    summary: "Get user data",
    description: "Retrieve user information",
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

#### Tag Features

- **Multiple Tags**: Operations can belong to multiple groups by specifying multiple tags
- **Automatic Generation**: The framework automatically generates the global tags section with descriptions
- **Swagger UI Integration**: Tags appear as collapsible sections in Swagger UI
- **Alphabetical Sorting**: Tags are automatically sorted alphabetically in the documentation

#### Example Usage

```typescript
// User management operations
export const GET = createRoute({
  spec: {
    tags: ["Users"],
    // ... rest of spec
  },
});

// Authentication operations
export const POST = createRoute({
  spec: {
    tags: ["Authentication", "Users"], // Multiple categories
    // ... rest of spec
  },
});

// Health check operations
export const GET = createRoute({
  spec: {
    tags: ["Health"],
    // ... rest of spec
  },
});
```

The generated OpenAPI specification will include:

- A global `tags` section with descriptions for each tag
- Each operation tagged with the specified categories
- Organized sections in Swagger UI for better navigation

## Validation

In development mode, responses are validated against their schemas to ensure your API matches the documentation.
