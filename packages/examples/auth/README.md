# Ombrage Auth Example

This example demonstrates how to integrate authentication into an Ombrage Bun API using [Better Auth](https://better-auth.vercel.app/), a comprehensive authentication library for TypeScript.

## Features

- **Email & Password Authentication**: Sign up, sign in, and session management
- **Database Integration**: SQLite database with Drizzle ORM for user data storage
- **Proxy-Level Authentication**: Routes are protected automatically at the proxy level
- **OpenAPI Documentation**: Auto-generated API docs for authentication endpoints
- **Comprehensive Testing**: Full integration test suite for auth functionality

## Setup

1. **Install dependencies**:

   ```bash
   bun install
   ```

2. **Start the development server**:
   ```bash
   bun run dev
   ```

The API will be available at `http://localhost:8080` with the following endpoints:

- `/` - Swagger UI documentation
- `/api-docs.json` - OpenAPI specification
- `/auth/**` - Authentication endpoints (handled by Better Auth)
- `/test` - Public test endpoint
- `/protected/**` - Protected routes requiring authentication

## Protected Routes

This example demonstrates two approaches to protecting routes:

### 1. Proxy-Level Protection (Recommended)

Routes under `/protected/**` are automatically secured by the proxy system. The proxy validates sessions and injects user information into request headers:

- `/protected` - User profile endpoint
- `/protected/dashboard` - Dashboard with user stats

These routes receive user information via headers:

- `x-user-id` - User ID
- `x-user-email` - User email
- `x-user-name` - User name

### 2. Route-Level Protection (Optional)

For routes outside `/protected/**` that need authentication, use the `requireAuth` middleware from `lib/middleware.ts`.

## Authentication Endpoints

The following auth endpoints are available at `/auth/`:

### Sign Up

```bash
POST /auth/sign-up/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password",
  "name": "User Name"
}
```

### Sign In

```bash
POST /auth/sign-in/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password"
}
```

### Get Session

```bash
GET /auth/get-session
Cookie: better-auth.session_token=<session-token>
```

### Sign Out

```bash
POST /auth/sign-out
Cookie: better-auth.session_token=<session-token>
```

### OpenAPI Documentation

```bash
GET /auth/openapi
```

## Testing

The example includes comprehensive integration tests that cover:

- **Authentication flows**: Sign up, sign in, session management, sign out
- **Error handling**: Invalid credentials, duplicate registration, malformed requests
- **Proxy integration**: Verification that auth routes are properly proxied
- **API functionality**: Server endpoints, OpenAPI documentation, error responses

Run all tests:

```bash
bun test
```

Run only integration tests:

```bash
bun test:integration
```

Run with coverage:

```bash
bun test:coverage
```

## Key Implementation Details

### Database Schema

The project uses Drizzle ORM with SQLite for persistence. The schema includes:

- **users**: User accounts with email, password hash, and profile info
- **sessions**: Active user sessions with tokens and metadata
- **accounts**: OAuth account linking (for future social auth)
- **verification**: Email verification tokens

### Proxy Configuration

Authentication is handled through Ombrage's proxy system:

```typescript
proxy: {
  enabled: true,
  configs: [
    {
      pattern: "/auth/**",
      handler: async ({ request }) => {
        const response = await auth.handler(request);
        return {
          proceed: false,
          response: response || new Response("Auth endpoint not found", { status: 404 })
        };
      }
    }
  ]
}
```

This allows Better Auth to handle all `/auth/*` requests while integrating seamlessly with the Ombrage API framework.

### Better Auth Configuration

The auth system is configured with:

- SQLite database adapter using Drizzle
- Email/password authentication
- OpenAPI plugin for documentation
- Custom base path (`/auth`)

## Production Considerations

For production deployment, consider:

1. **Environment Variables**: Move sensitive config to environment variables
2. **Database**: Use PostgreSQL or MySQL instead of SQLite
3. **Session Storage**: Configure Redis for session storage
4. **Email**: Set up SMTP for email verification
5. **Security**: Configure CORS, rate limiting, and other security headers
6. **Monitoring**: Add logging and error tracking

## Available Scripts

- `bun run dev` - Start development server with hot reload
- `bun run start` - Start production server
- `bun test` - Run all tests
- `bun test:integration` - Run integration tests only
- `bun test:coverage` - Run tests with coverage report

## Dependencies

### Runtime

- **ombrage-bun-api**: The main API framework
- **better-auth**: Authentication library
- **drizzle-orm**: Database ORM
- **zod**: Schema validation

### Development

- **@types/bun**: TypeScript types for Bun
- **drizzle-kit**: Database migration tools
- **openapi-types**: TypeScript types for OpenAPI
