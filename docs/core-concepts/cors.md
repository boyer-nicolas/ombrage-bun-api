# CORS (Cross-Origin Resource Sharing) Support

The Koritsu framework provides built-in CORS support to handle cross-origin requests from web browsers. This is essential when your API needs to serve frontend applications running on different domains, ports, or protocols.

## Overview

CORS is automatically handled at the framework level, meaning all your routes will receive CORS headers without any additional code. The framework handles both simple requests and preflight requests (OPTIONS) according to the CORS specification.

## Basic Configuration

Enable CORS by setting `cors.enabled` to `true` in your API configuration:

```typescript
import { Api } from "koritsu";

const api = new Api({
  environment: "development",
  cors: {
    enabled: true,
    origin: "http://localhost:3000", // Allow requests from your frontend
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
  server: {
    port: 8080,
    routes: { dir: "./routes" },
  },
});
```

## Configuration Options

### `origin`

Controls which origins are allowed to make requests to your API.

```typescript
// Allow a single origin
cors: {
  origin: "https://myapp.com";
}

// Allow multiple specific origins
cors: {
  origin: [
    "https://myapp.com",
    "https://staging.myapp.com",
    "http://localhost:3000",
  ];
}

// Allow all origins (not recommended for production)
cors: {
  origin: "*"; // or true
}

// Disable CORS completely
cors: {
  origin: false;
}
```

**Security Note**: Using `"*"` allows any website to make requests to your API. Only use this in development or for truly public APIs.

### `methods`

Specify which HTTP methods are allowed for cross-origin requests:

```typescript
cors: {
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
}
```

**Default**: `["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]`

### `allowedHeaders`

Define which request headers the client is allowed to send:

```typescript
cors: {
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"];
}
```

**Default**: `["Content-Type", "Authorization"]`

### `exposedHeaders`

Specify which response headers should be accessible to the client:

```typescript
cors: {
  exposedHeaders: ["X-Total-Count", "X-Rate-Limit-Remaining"];
}
```

**Default**: `undefined` (no additional headers exposed)

### `credentials`

Allow cookies and authorization headers to be sent with requests:

```typescript
cors: {
  credentials: true; // Allow credentials
}
```

**Default**: `false`

**Important**: When `credentials: true`, you cannot use `origin: "*"`. You must specify exact origins.

### `maxAge`

How long (in seconds) browsers should cache preflight response:

```typescript
cors: {
  maxAge: 86400; // Cache for 24 hours
}
```

**Default**: `3600` (1 hour)  
**Range**: 0-86400 seconds (max 24 hours)

### `optionsSuccessStatus`

HTTP status code for successful OPTIONS (preflight) requests:

```typescript
cors: {
  optionsSuccessStatus: 200; // Use 200 instead of default 204
}
```

**Default**: `204`

## Complete Example

```typescript
import { Api } from "koritsu";

const api = new Api({
  environment: "production",
  cors: {
    enabled: true,
    origin: [
      "https://myapp.com",
      "https://admin.myapp.com",
      ...(process.env.NODE_ENV === "development"
        ? ["http://localhost:3000"]
        : []),
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-API-Key",
      "X-Requested-With",
    ],
    exposedHeaders: [
      "X-Total-Count",
      "X-Rate-Limit-Remaining",
      "X-Rate-Limit-Reset",
    ],
    credentials: true,
    maxAge: 3600, // 1 hour
    optionsSuccessStatus: 204,
  },
  server: {
    port: 8080,
    routes: { dir: "./routes" },
  },
});
```

## Environment-Based Configuration

You can configure different CORS settings per environment:

```typescript
const corsOrigins = {
  development: ["http://localhost:3000", "http://localhost:3001"],
  staging: ["https://staging.myapp.com"],
  production: ["https://myapp.com", "https://admin.myapp.com"],
};

const api = new Api({
  environment: process.env.NODE_ENV || "development",
  cors: {
    enabled: true,
    origin: corsOrigins[process.env.NODE_ENV || "development"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  // ... other config
});
```

## How CORS Works in Koritsu

1. **Preflight Requests**: When a browser makes a "complex" request (like POST with JSON), it first sends an OPTIONS request to check permissions.
2. **Automatic Handling**: Koritsu intercepts OPTIONS requests and responds with appropriate CORS headers based on your configuration.
3. **Header Addition**: For all responses, Koritsu automatically adds CORS headers when CORS is enabled.
4. **Route Integration**: Your route handlers don't need any CORS-specific code - it's handled transparently.

## Common Use Cases

### Frontend Development

```typescript
// Perfect for local development
cors: {
  enabled: true,
  origin: "http://localhost:3000",
  credentials: true,
}
```

### Public API

```typescript
// For APIs that serve public data
cors: {
  enabled: true,
  origin: "*",
  credentials: false,  // No authentication needed
  methods: ["GET", "HEAD", "OPTIONS"],
}
```

### Multi-Tenant Application

```typescript
// For apps serving multiple domains
cors: {
  enabled: true,
  origin: [
    "https://client1.myapp.com",
    "https://client2.myapp.com",
    "https://admin.myapp.com"
  ],
  credentials: true,
}
```

### Mobile App Backend

```typescript
// For mobile apps that don't need CORS
cors: {
  enabled: false; // Mobile apps don't have CORS restrictions
}
```

## Troubleshooting

### "CORS Error" in Browser

**Problem**: Browser shows CORS-related error messages.

**Solutions**:

1. Check that `cors.enabled` is `true`
2. Verify the frontend's origin is in your `origin` list
3. Ensure all required headers are in `allowedHeaders`
4. Check that the HTTP method is in `methods`

### Authentication Issues

**Problem**: Authenticated requests fail with CORS errors.

**Solutions**:

1. Set `credentials: true` in CORS config
2. Ensure frontend sends `credentials: "include"` in fetch requests
3. Don't use `origin: "*"` when credentials are enabled
4. Add `"Authorization"` to `allowedHeaders`

### Preflight Failures

**Problem**: OPTIONS requests return 405 or 403.

**Solutions**:

1. Check browser dev tools Network tab for the failed OPTIONS request
2. Verify the requested method is in your `methods` array
3. Check that requested headers are in `allowedHeaders`
4. Ensure the origin is allowed

### Headers Not Accessible

**Problem**: Frontend can't read certain response headers.

**Solution**: Add the headers to `exposedHeaders`:

```typescript
cors: {
  exposedHeaders: ["X-Total-Count", "X-Custom-Header"];
}
```

### Development vs Production

**Problem**: Works in development but fails in production.

**Solution**: Check that production origins are correctly configured:

```typescript
cors: {
  origin: process.env.NODE_ENV === "production"
    ? ["https://myapp.com"]
    : ["http://localhost:3000"];
}
```

## Security Best Practices

1. **Specify Exact Origins**: Avoid `origin: "*"` in production
2. **Limit Methods**: Only allow methods your API actually uses
3. **Restrict Headers**: Don't allow unnecessary headers
4. **Use HTTPS**: Always use HTTPS in production for credentialed requests
5. **Environment Separation**: Use different origins for dev/staging/prod

## Integration with Frontend

### Fetch API

```javascript
// Frontend code
fetch("http://localhost:8080/api/users", {
  method: "POST",
  credentials: "include", // Include cookies/auth headers
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token,
  },
  body: JSON.stringify(userData),
});
```

### Axios

```javascript
// Axios configuration
axios.defaults.withCredentials = true;
axios.defaults.baseURL = "http://localhost:8080";

// Or per request
axios.post("/api/users", userData, {
  withCredentials: true,
});
```

The Koritsu CORS implementation follows the [W3C CORS specification](https://www.w3.org/TR/cors/) and handles all edge cases automatically, allowing you to focus on building your API without worrying about cross-origin complexities.
