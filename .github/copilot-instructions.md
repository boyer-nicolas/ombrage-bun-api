# Ombrage Bun API - Copilot Instructions

## Project Architecture

This is a **file-based routing system** for Bun APIs with automatic OpenAPI documentation generation. The architecture follows these key patterns:

### Core Components
- **`src/lib/api.ts`**: Main `Api` class that orchestrates server lifecycle 
- **`src/lib/router.ts`**: `FileRouter` class handles route discovery, loading, and request matching
- **`src/lib/helpers.ts`**: `createRoute()` function and Zod-to-OpenAPI conversion utilities
- **`src/lib/config.ts`**: Configuration schema and validation using Zod

### Route Discovery Flow
1. `FileRouter.discoverRoutes()` scans `routes/` directory recursively
2. Only `route.ts` files are processed (not `index.ts` or other names)
3. Dynamic routes use `[param]` folder syntax (e.g., `users/[id]/route.ts`)
4. Routes are matched: exact match first, then dynamic routes, then prefix matching

## Development Patterns

### Route Creation
Always use `createRoute()` from `src/lib/helpers.ts`:

```typescript
export const GET = createRoute({
  method: "GET",
  handler: async ({ params, query, body, headers }) => {
    // Route logic here
    return Response.json(data);
  },
  spec: {
    format: "json",
    tags: ["Users"],
    summary: "Get user data",
    parameters: {
      path: z.object({ id: z.string().uuid() }),
      query: z.object({ include: z.array(z.string()).optional() })
    },
    responses: {
      200: { schema: userSchema }
    }
  }
});
```

### Key Conventions
- **One HTTP method per export**: `export const GET`, `export const POST`, etc.
- **Zod schemas for everything**: Parameters, body, responses - all use Zod for validation and OpenAPI generation
- **Spec-driven development**: Route specs generate OpenAPI docs automatically via `zodToOpenAPISchema()`
- **Type safety**: `createRoute<TSpec>()` provides type inference from specs

### Parameter Handling
The framework automatically validates and parses:
- **Path params**: From `[id]` folder structure → `params.id`
- **Query params**: From URL search params → `query.limit`  
- **Body**: JSON requests → `body` object
- **Headers**: HTTP headers → `headers` object

### Error Handling
- 404 for non-existent routes
- 405 for unsupported HTTP methods  
- 400 for Zod validation failures with detailed error messages
- 500 responses automatically added to OpenAPI specs

## Development Workflow

### Local Development
```bash
bun run dev        # Hot reload dev server with dev/routes
bun run test       # Run all tests
bun run lint       # Biome formatting and linting
bun run test:coverage  # Tests with coverage reports
```

### Environment Setup
Available development modes:
- **Library development**: `dev/index.ts` with `dev/routes/` for testing core functionality
Start the dev server with `&` to run in background:
```bash
bun run dev &
```
Always kill background server before publishing or running tests:
```bash
kill $(lsof -t -i:8080)  # Adjust port as needed
```

### Key Scripts & Tools
- **`scripts/test-with-coverage.ts`**: Automated test pipeline (tests → coverage → badge generation)
- **`scripts/publish.ts`**: Complete publish pipeline (lint → test → build → publish)
- **`build.ts`**: Bun build targeting CommonJS for NPM compatibility
- **`bunfig.toml`**: Test configuration with coverage thresholds (70% line, 80% function, 90% statement)

### Project Structure Rules
- **`src/`**: Main library code (never edit files outside exports)
- **`dev/`**: Development sandbox (`routes/`, `lib/`, `public/`)
- **`examples/`**: Complete working implementations with independent package.json
- **`tests/`**: Split into `unit/` and `integration/` directories
- **`dist/`**: Built output (auto-generated, git-ignored)

### Testing Patterns
Integration tests use real server instances:
```typescript
const serverInstance = new Api({
  server: { routes: { dir: "./dev/routes" }, port: 0 }
});
const server = await serverInstance.start();
// port: 0 = random available port for parallel testing
```

**Coverage expectations**: Tests validate both successful paths and error scenarios (param validation, status code mismatches, etc.)

### Configuration System
Multi-layered configuration with environment variable support:
```typescript
// Programmatic config (preferred)
new Api({
  server: { port: 8080, routes: { dir: "./routes" } },
  title: "My API"
})

// Environment variables (automatic coercion)
PORT=8080 LOG_LEVEL=debug bun run dev
```

Config validates via Zod with automatic type coercion (strings → numbers/booleans). Access globally via `getConfig()` after `validateConfig()`.

## Advanced Patterns

### Schema Organization
Organize Zod schemas in separate files for reusability:
```typescript
// lib/schemas.ts
export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100)
});

// routes/users/route.ts
import { userSchema } from "../../lib/schemas";
```

### Response Validation
In development, responses are validated against OpenAPI specs. Tests verify this behavior:
- Mismatched status codes throw errors
- Content-Type validation enforced
- Schema validation for response bodies (when enabled)

### Static File Serving
Configure via `server.static`:
```typescript
static: {
  dir: "./dev/public",
  enabled: true,
  basePath: "/static"
}
```
Static routes are processed before dynamic routes, served directly from filesystem.

## OpenAPI Integration

### Automatic Documentation
- **Swagger UI**: Served at `/` (configurable via `swagger.path`)
- **OpenAPI spec**: Available at `/api-docs.json`
- **Schema conversion**: `zodToOpenAPISchema()` handles complex Zod types (unions, arrays, nested objects)
- **Tags**: Group operations in Swagger UI via `spec.tags`

### OpenAPI Generation Process
1. Route files scanned for exported HTTP methods (GET, POST, etc.)
2. Each method's `spec` property converted to OpenAPI operation
3. Path parameters automatically converted from `[param]` to `{param}` syntax
4. Zod schemas introspected at runtime for JSON Schema generation
5. Global tags section auto-generated from all route tags

### Spec Validation Features
Development mode validates:
- Response status codes match spec definitions
- Content-Type headers align with spec expectations
- Proper error handling for validation failures

## Build & Distribution

### Build Process
```bash
bun run build:clean    # Remove dist/
bun run build:types    # Generate .d.ts via dts-bundle-generator
bun run build:js       # Bun build → CommonJS output
```

### Publishing Pipeline (GitHub Actions)
Automated on `main` branch push:
1. **Quality checks**: Type checking, linting, full test suite
2. **Coverage**: Generate reports and update README badge
3. **Change detection**: Skip publish if only coverage updates (`[skip ci]`)
4. **Version management**: `changelogen` for automatic changelog + version bump
5. **NPM publish**: Automated with `NPM_TOKEN` secret
6. **GitHub release**: Auto-generated with changelog content

### Package Configuration
- **Entry points**: `main` (CommonJS), `module` (ESM source), `types` (declarations)
- **Exports**: Single entry point (`"."`) for clean imports
- **Peer dependencies**: TypeScript required for type safety
- **Files whitelist**: Only `dist/` published to NPM

### Development Dependencies
- **Biome**: Formatting and linting (tab indentation, double quotes)
- **Husky + lint-staged**: Pre-commit hooks for code quality
- **Changelogen**: Conventional commit changelog generation
- **GitHub Actions**: Fully automated CI/CD pipeline


### Documentation
- **docs/**: Markdown documentation files, handled by Vitepress
- **README.md**: Main project overview and usage instructions
