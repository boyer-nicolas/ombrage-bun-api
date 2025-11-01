# Ombrage API Example

This example demonstrates how to use the `ombrage-bun-api` library to create a complete API with file-based routing, automatic OpenAPI documentation, and type-safe request/response handling.

## Setup

1. Install dependencies:

```bash
bun install
```

2. Start the development server:

```bash
bun run dev
```

The server will start at http://localhost:8080

## Available Endpoints

### Health Check

- **GET /healthz** - Returns service health status
- **POST /healthz** - Echo endpoint for testing

### Users API

- **GET /users** - Get all users with optional filtering
  - Query parameters: `limit` (number), `search` (string)
- **POST /users** - Create a new user
  - Body: `{ name: string, email: string }`
- **GET /users/{id}** - Get a specific user by ID
- **PUT /users/{id}** - Update a user
  - Body: `{ name?: string, email?: string }`

## API Documentation

Once the server is running, you can access:

- **Swagger UI**: http://localhost:8080
- **OpenAPI JSON**: http://localhost:8080/api-docs.json

## Key Features Demonstrated

### 1. File-based Routing

Routes are automatically discovered from the file structure:

```
routes/
  healthz/
    route.ts
  users/
    route.ts
    [id]/
      route.ts
```

### 2. Type-safe Parameters

Using Zod schemas for automatic validation and type inference:

```typescript
spec: {
  format: "json",
  parameters: {
    path: z.object({
      id: z.string().describe("User ID")
    }),
    body: z.object({
      name: z.string().min(1).describe("User's name"),
      email: z.string().email().describe("User's email")
    })
  },
  responses: {
    200: {
      summary: "User updated successfully",
      description: "User updated successfully",
      schema: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        updatedAt: z.string()
      })
    }
  }
}
```

### 3. Automatic OpenAPI Documentation

All routes with specs are automatically included in the generated OpenAPI documentation with:

- Parameter validation
- Request/response schemas
- Type descriptions
- Example values

### 4. Built-in Error Handling

The framework automatically handles:

- Parameter validation errors (400 Bad Request)
- Missing routes (404 Not Found)
- Unsupported methods (405 Method Not Allowed)
- Server errors (500 Internal Server Error)

## Testing the API

### Health Check

```bash
curl http://localhost:8080/healthz
```

### Get Users

```bash
curl http://localhost:8080/users
curl "http://localhost:8080/users?limit=2&search=john"
```

### Create User

```bash
curl -X POST http://localhost:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice Cooper", "email": "alice@example.com"}'
```

### Get User by ID

```bash
curl http://localhost:8080/users/1
```

### Update User

```bash
curl -X PUT http://localhost:8080/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "John Updated", "email": "john.updated@example.com"}'
```

### Echo Test

```bash
curl -X POST http://localhost:8080/healthz \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from the API!"}'
```

## Directory Structure

```
example/
├── package.json          # Dependencies and scripts
├── src/
│   └── index.ts          # Server entry point
├── tests/
│   └── example-api.integration.test.ts  # Integration tests
└── routes/               # API routes
    ├── healthz/
    │   └── route.ts      # Health check endpoints
    ├── health/
    │   └── route.ts      # Custom health endpoints
    └── users/
        ├── route.ts      # User collection endpoints
        └── [id]/
            └── route.ts  # Individual user endpoints
```

## Integration Tests

The example includes comprehensive integration tests that demonstrate how to test APIs built with Ombrage:

```bash
bun run test
```

The integration tests cover:

- Built-in health check endpoints (`/healthz`)
- Custom health endpoints (`/health`) with JSON responses
- User CRUD operations with validation
- Query parameter handling and filtering
- Request body validation and error scenarios
- OpenAPI documentation generation

The tests show how to:

- Start a server process for integration testing
- Test multiple endpoints with different HTTP methods
- Validate response formats and status codes
- Test error handling and validation scenarios
- Verify OpenAPI documentation is served correctly

This demonstrates a complete testing strategy for APIs built with the Ombrage framework.

This example shows how the `ombrage-bun-api` library provides a clean, type-safe way to build APIs with minimal boilerplate while automatically generating comprehensive documentation.
