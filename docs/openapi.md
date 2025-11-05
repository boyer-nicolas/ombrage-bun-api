# OpenAPI Integration

Ombrage Bun API automatically generates OpenAPI (Swagger) documentation from your route specifications.

## Automatic Documentation

Every route spec contributes to the generated OpenAPI schema:

```typescript
export const GET = createRoute({
  method: "GET",
  callback: async ({ params }) => {
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

## Validation

In development mode, responses are validated against their schemas to ensure your API matches the documentation.
