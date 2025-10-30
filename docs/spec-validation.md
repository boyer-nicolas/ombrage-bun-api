# OpenAPI Spec Validation in Routes

## Overview

The `createRoute` helper now supports OpenAPI specification validation. When you provide a `spec` parameter, it will automatically validate that your route responses match the expected status codes defined in your OpenAPI specification.

## Usage

### Basic Usage

```typescript
import { createRoute } from "@lib/helpers";
import bucketSpec from "./spec";

export const POST = createRoute({
  method: "POST",
  callback: async ({ request }) => {
    const body = await request.json();
    const result = await createBucket(body.name);

    // IMPORTANT: Make sure to return the status code expected by your spec
    return Response.json(result, { status: 201 }); // Spec expects 201
  },
  spec: bucketSpec["/storage/buckets"]?.post, // Reference to your OpenAPI operation spec
});
```

### What Gets Validated

1. **Response Status Codes**: Validates that the returned status code is defined in the spec's `responses` object
2. **Content-Type** (warning only): Warns if the Content-Type doesn't match expected types
3. **Future enhancements**: Response body schema validation, header validation

### Development vs Production Behavior

- **Development Mode** (`ENVIRONMENT=development`): Throws errors when validation fails
- **Production Mode**: Logs errors but doesn't break the response flow

### Example Error Message

```
OpenAPI spec validation failed for POST: Response status 200 is not defined in the OpenAPI spec for POST operation. Expected one of: 201
```

## Example Implementation

See `/routes/storage/buckets/route.ts` for a complete example:

- GET endpoint: Returns 200 status (matches spec)
- POST endpoint: Returns 201 status (matches spec)
- Both endpoints include spec validation

## Benefits

1. **Automatic Validation**: Catches mismatches between implementation and documentation
2. **Development Safety**: Errors in development help catch issues early
3. **Documentation Compliance**: Ensures your API actually returns what your spec promises
4. **Type Safety**: Leverages TypeScript and OpenAPI types for better development experience

## Testing

Run the spec validation tests:

```bash
bun test lib/__tests__/spec-validation.test.ts
```
