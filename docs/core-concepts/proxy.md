# Proxy Functionality in Ombrage Framework

This document demonstrates how to use the new proxy functionality with wildcard patterns and callback support.

## Overview

The proxy system allows you to:

- Forward requests to external services based on wildcard patterns
- Execute callbacks for authentication, logging, or transformation
- Handle multiple wildcards in paths for complex routing
- Configure timeouts, retries, and headers per proxy
- Support all HTTP methods (GET, POST, PUT, DELETE, etc.)

## Basic Configuration

```typescript
import { Api, createProxyConfig } from "ombrage-bun-api";

const api = new Api({
  environment: "development",
  proxy: {
    enabled: true,
    configs: [
      // Simple proxy without callback
      createProxyConfig("/api/*", "https://external-api.example.com"),

      // Proxy with authentication callback
      createProxyConfig("/api/protected/*", "https://secure-api.example.com", {
        callback: async ({ request, params, target }) => {
          const token = request.headers.get("authorization");
          if (!token) {
            return {
              proceed: false,
              response: new Response("Unauthorized", { status: 401 }),
            };
          }
          return { proceed: true };
        },
      }),
    ],
  },
});
```

## Wildcard Pattern Matching

Wildcards (`*`) can be used anywhere in the path and extracted as parameters:

```typescript
// Single wildcard - matches /users/123, /users/admin, etc.
createProxyConfig("/users/*", "https://user-service.com");

// Multiple wildcards - matches /tenants/acme/services/auth/data
createProxyConfig("/tenants/*/services/*/data", "https://multi-tenant.com");

// Mixed patterns - matches /api/v1/users/123/posts/456
createProxyConfig("/api/v1/users/*/posts/*", "https://content-service.com");
```

## Callback Functions

Callbacks receive request details and can:

- Block requests by returning `proceed: false`
- Modify headers or target URL
- Perform authentication, logging, rate limiting, etc.

```typescript
const authCallback = async ({ request, params, target }) => {
  // Access extracted parameters from wildcards
  const userId = params.param0; // First wildcard value
  const postId = params.param1; // Second wildcard value

  // Validate authorization
  const token = request.headers.get("authorization");
  if (!isValidToken(token)) {
    return {
      proceed: false,
      response: new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  // Add custom headers for downstream service
  return {
    proceed: true,
    headers: {
      "X-User-ID": userId,
      "X-Original-Host": request.headers.get("host"),
    },
  };
};
```

## Advanced Configuration

```typescript
createProxyConfig("/api/external/*", "https://external-service.com", {
  description: "External API proxy with auth",
  callback: authCallback,
  timeout: 15000, // 15 second timeout
  retries: 3, // Retry failed requests 3 times
  headers: {
    // Additional headers for all requests
    "X-API-Gateway": "ombrage",
    "X-Version": "1.0",
  },
});
```

## Dynamic Target Selection

Callbacks can change the target URL based on request parameters:

```typescript
const routingCallback = async ({ request, params, target }) => {
  const tenantId = params.param0;

  // Route premium tenants to different service
  const finalTarget =
    tenantId === "premium"
      ? "https://premium-service.com"
      : "https://standard-service.com";

  return {
    proceed: true,
    target: finalTarget,
    headers: {
      "X-Tenant-ID": tenantId,
    },
  };
};
```

## Error Handling

The proxy system automatically handles:

- **Connection failures**: Returns 502 Bad Gateway
- **Timeouts**: Configurable per proxy, returns 502 on timeout
- **Retries**: Exponential backoff for failed requests
- **404s**: Non-matching patterns return 404 Not Found

## Integration with File-Based Routes

Proxies are checked **before** file-based routes, allowing you to:

- Proxy some paths to external services
- Handle others with local route files
- Override specific paths with local implementations

## Testing

The framework includes comprehensive tests for:

- Pattern matching with various wildcard combinations
- Callback execution and parameter extraction
- Authentication and authorization flows
- Error handling and timeouts
- Integration with the file-based routing system

## Example Use Cases

1. **API Gateway**: Proxy different API versions to different services
2. **Authentication Layer**: Validate tokens before forwarding requests
3. **Load Balancing**: Route requests based on tenant or user type
4. **Legacy Migration**: Gradually migrate endpoints from old to new services
5. **Rate Limiting**: Implement custom rate limiting in callbacks
6. **Request Transformation**: Modify headers or request data before forwarding

## Performance Considerations

- Proxies are checked in order of specificity (fewer wildcards = higher priority)
- Callbacks should be fast to avoid blocking request processing
- Use appropriate timeouts to prevent hanging requests
- Consider retry strategy based on your target service characteristics

## Security Notes

- Callbacks have access to all request data - handle sensitive information carefully
- Validate all extracted parameters before using them
- Consider implementing rate limiting and request size limits
- Use HTTPS for target URLs when handling sensitive data
