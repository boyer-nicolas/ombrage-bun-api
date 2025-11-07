# Proxy Functionality in the Koritsu Framework

This document demonstrates how to use the new proxy functionality with wildcard patterns and handler support.

## Overview

The proxy system allows you to:

- Forward requests to external services based on wildcard patterns
- Execute handlers for authentication, logging, or transformation
- Handle multiple wildcards in paths for complex routing
- Configure timeouts, retries, and headers per proxy
- Support all HTTP methods (GET, POST, PUT, DELETE, etc.)

## Basic Configuration

```typescript
import { Api } from "koritsu";

const api = new Api({
  environment: "development",
  proxy: {
    enabled: true,
    configs: [
      // Simple proxy without handler
      {
        pattern: "/api/*",
        target: "https://external-api.example.com",
      },

      // Proxy with authentication handler
      {
        pattern: "/api/protected/*",
        target: "https://secure-api.example.com",
        handler: async ({ request, params, target }) => {
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
{
  pattern: "/users/*",
  target: "https://user-service.com",
},

// Multiple wildcards - matches /tenants/acme/services/auth/data
{
  pattern: "/tenants/*/services/*/data",
  target: "https://multi-tenant.com",
},

// Mixed patterns - matches /api/v1/users/123/posts/456
{
  pattern: "/api/v1/users/*/posts/*",
  target: "https://content-service.com",
},
```

## Handler Functions

Handlers receive request details and can:

- Block requests by returning `proceed: false`
- Modify headers or target URL
- Perform authentication, logging, rate limiting, etc.

```typescript
const authHandler = async ({ request, params, target }) => {
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
{
  pattern: "/api/external/*",
  target: "https://external-service.com",
  description: "External API proxy with auth",
  handler: authHandler,
  timeout: 15000, // 15 second timeout
  retries: 3, // Retry failed requests 3 times
  logging: true, // Enable proxy logging (default: true)
  headers: {
    // Additional headers for all requests
    "X-API-Gateway": "koritsu",
    "X-Version": "1.0",
  },
});
```

### Controlling Proxy Logging

By default, the proxy logs successful requests, retries, and errors. You can control this behavior using the `logging` property:

```typescript
// Enable logging (default behavior)
{
  pattern: "/api/verbose/*",
  target: "https://api.example.com",
  logging: true, // Will log: [INFO] Proxied GET /api/verbose/test -> https://api.example.com/api/verbose/test (200) [attempt 1]
}

// Disable logging for quieter operation
{
  pattern: "/api/quiet/*",
  target: "https://api.example.com",
  logging: false, // No proxy logs will be generated
}
```

When logging is disabled, the proxy will still function normally but won't generate any log messages for:

- Successful proxy requests
- Retry attempts
- Error messages from failed proxy requests

This is useful for:

- **High-traffic endpoints**: Reduce log noise for frequently accessed APIs
- **Health checks**: Avoid cluttering logs with routine health check requests
- **Development environments**: Focus logs on specific proxy configurations
- **Production optimization**: Reduce logging overhead for performance-critical paths

Note: Disabling proxy logging only affects the proxy-specific log messages. General HTTP request logs and application-level logs are controlled separately.

## Dynamic Target Selection

Handlers can change the target URL based on request parameters:

```typescript
const routingHandler = async ({ request, params, target }) => {
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

## Auth-Only Endpoints (No Proxying)

You can create proxy configurations that handle requests entirely within the handler without forwarding to an external service by omitting the `target` field:

```typescript
{
  pattern: "/auth/*",
  // No target specified - handled entirely by the handler
  description: "Authentication endpoints handled locally",
  handler: async ({ request }) => {
    const url = new URL(request.url);

    if (url.pathname === "/auth/login") {
      // Handle login logic
      const body = await request.json() as { username?: string; password?: string };

      if (body.username === "admin" && body.password === "secret") {
        return {
          proceed: false, // Don't proxy anywhere
          response: new Response(JSON.stringify({
            success: true,
            token: "jwt-token-here",
            user: { id: 1, username: "admin" }
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        };
      } else {
        return {
          proceed: false,
          response: new Response(JSON.stringify({
            error: "Invalid credentials"
          }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
          })
        };
      }
    }

    if (url.pathname === "/auth/validate") {
      // Handle token validation
      const authHeader = request.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return {
          proceed: false,
          response: new Response(JSON.stringify({
            error: "Missing authorization header"
          }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
          })
        };
      }

      // Validate token and return user info
      return {
        proceed: false,
        response: new Response(JSON.stringify({
          valid: true,
          user: { id: 1, username: "admin" }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      };
    }

    // Default 404 for unhandled auth endpoints
    return {
      proceed: false,
      response: new Response(JSON.stringify({
        error: "Auth endpoint not found"
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      })
    };
  }
}
```

This pattern is useful for:

- **Authentication services**: Handle login, logout, token validation locally
- **API rate limiting**: Block requests without forwarding
- **Request validation**: Validate and reject malformed requests
- **Mock endpoints**: Return mock data during development
- **Health checks**: Respond to health/status requests locally

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
- Handler execution and parameter extraction
- Authentication and authorization flows
- Error handling and timeouts
- Integration with the file-based routing system

## Example Use Cases

1. **API Gateway**: Proxy different API versions to different services
2. **Authentication Layer**: Validate tokens before forwarding requests
3. **Auth-Only Services**: Handle authentication endpoints locally without proxying
4. **Load Balancing**: Route requests based on tenant or user type
5. **Legacy Migration**: Gradually migrate endpoints from old to new services
6. **Rate Limiting**: Implement custom rate limiting in handlers
7. **Request Transformation**: Modify headers or request data before forwarding
8. **Mock Services**: Return mock responses during development/testing
9. **Health Checks**: Handle health/status endpoints locally

## Performance Considerations

- Proxies are checked in order of specificity (fewer wildcards = higher priority)
- Handlers should be fast to avoid blocking request processing
- Use appropriate timeouts to prevent hanging requests
- Consider retry strategy based on your target service characteristics

## Security Notes

- Handlers have access to all request data - handle sensitive information carefully
- Validate all extracted parameters before using them
- Consider implementing rate limiting and request size limits
- Use HTTPS for target URLs when handling sensitive data
