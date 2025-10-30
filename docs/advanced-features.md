# Advanced Features

## OpenAPI Spec Validation

This framework provides comprehensive OpenAPI specification validation to ensure your API routes return exactly what's defined in their specs.

### Runtime Validation

When you pass a `spec` to the `createRoute` helper, the framework automatically validates responses at runtime:

```typescript
import { createRoute } from "@lib/helpers";
import spec from "./spec";

export const POST = createRoute({
  method: "POST",
  spec: spec["/storage/buckets"]?.post, // Spec defines 201 status code
  callback: async ({ request }) => {
    const body = await request.json();

    // This response will be validated against the spec
    return Response.json(newBucket, { status: 201 }); // ✅ Matches spec

    // If you return status 200 instead:
    // return Response.json(newBucket, { status: 200 }); // ❌ Throws error in development
  },
});
```

### Validation Behavior

**Development Mode**: Throws errors immediately when responses don't match specs
**Production Mode**: Logs warnings but doesn't break the response

The validation checks:

- Response status codes must be defined in the spec
- Content-Type headers match expected types
- Proper error messages for debugging

### Environment Detection

Validation behavior depends on these environment variables:

- `NODE_ENV === "development"`
- `ENVIRONMENT === "development"`

## TypeScript Type Safety

The framework includes advanced TypeScript features for compile-time safety:

### Typed Response Helpers

```typescript
import { createTypedResponse } from "@lib/helpers";

// Create a type-safe response helper from your spec
const typedResponse = createTypedResponse(spec);

// TypeScript enforces valid status codes at compile time
return typedResponse.json(data, {
  status: 201, // ✅ Must match status codes defined in spec
});
```

### Route Parameter Extraction

TypeScript utilities extract parameter types from OpenAPI specs:

```typescript
// These types are automatically inferred from your spec:
type ExtractPathParams<T> = // Extracts path parameters
type ExtractQueryParams<T> = // Extracts query parameters
type ExtractRequestBody<T> = // Extracts request body schema
```

### Enhanced RouteProps

The `RouteProps` type can be enhanced with spec information:

```typescript
export type RouteProps<TSpec = OpenAPIV3_1.OperationObject> = {
  request: Request;
  params?: ExtractPathParams<TSpec>; // Typed path parameters
  body?: ExtractRequestBody<TSpec>; // Typed request body
  query?: ExtractQueryParams<TSpec>; // Typed query parameters
  validator?: unknown;
};
```

## Example Implementation

Here's a complete example showing both runtime validation and type safety:

```typescript
// spec.ts
export default {
  "/storage/buckets": {
    post: {
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
              },
              required: ["name"],
            },
          },
        },
      },
      responses: {
        "201": {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  created_at: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
};

// route.ts
import { createRoute } from "@lib/helpers";
import spec from "./spec";

export const POST = createRoute({
  method: "POST",
  spec: spec["/storage/buckets"]?.post,
  callback: async ({ request }) => {
    const body: { name: string } = await request.json();

    const newBucket = {
      id: `bucket-${Date.now()}`,
      name: body.name,
      created_at: new Date().toISOString(),
    };

    // Runtime validation ensures this matches the spec
    return Response.json(newBucket, { status: 201 });
  },
});
```

## Benefits

1. **Runtime Safety**: Catch spec violations immediately in development
2. **Type Safety**: TypeScript prevents many errors at compile time
3. **Documentation**: Your specs become the source of truth
4. **Testing**: Automatic validation in your test suite
5. **Debugging**: Clear error messages when responses don't match specs

## Testing

The framework includes comprehensive tests for validation:

```bash
bun test lib/__tests__/spec-validation.test.ts
```

This ensures that:

- Valid responses pass validation
- Invalid responses throw appropriate errors
- Environment-based behavior works correctly
- Content-Type validation functions properly

## Future Enhancements

Planned features include:

- Request body validation against JSON schemas
- Parameter validation for path/query parameters
- Enhanced TypeScript compile-time validation
- Custom validation rules and middleware
- Performance optimization for production environments
