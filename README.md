# [Ombrage API](https://www.npmjs.com/package/ombrage-bun-api)

[![CI](https://github.com/boyer-nicolas/ombrage-bun-api/actions/workflows/publish.yaml/badge.svg)](https://github.com/boyer-nicolas/ombrage-bun-api/actions/workflows/publish.yaml)
[![NPM Version](https://img.shields.io/npm/v/ombrage-bun-api)](https://www.npmjs.com/package/ombrage-bun-api)
[![NPM Downloads](https://img.shields.io/npm/dm/ombrage-bun-api)](https://www.npmjs.com/package/ombrage-bun-api)
[![Coverage](https://img.shields.io/badge/coverage-91%25-brightgreen)](./coverage/)

A powerful file-based routing system built with Bun, featuring automatic API documentation generation with Swagger UI.

## Features

- 🚀 **File-based routing**: Routes auto-discovered from filesystem structure
- 📁 **Structured organization**: A simple `route.ts` file per endpoint
- 📖 **Auto-generated docs**: Swagger UI with OpenAPI 3.1 specifications
- 🛡️ **Type-safe validation**: Built with TypeScript and Zod schemas
- 🔍 **Health checks**: Built-in health check endpoint
- ⚙️ **Flexible configuration**: Class options and environment variables

## Quick Start

1. **Install the package**

```bash
bun install ombrage-bun-api
# or
npm install ombrage-bun-api
```

2. **Create the server entry point**

```typescript
// index.ts
import { Api } from "ombrage-bun-api";

new Api({
  server: {
    routes: {
      dir: "./routes", // Directory containing your route files
    },
  },
}).start();
```

3. **Create your first route**

```typescript
// routes/hello/route.ts
import { createRoute } from "ombrage-bun-api";
import { z } from "zod";

export const GET = createRoute({
  method: "GET",
  callback: async () => {
    return Response.json({ message: "Hello, world!" });
  },
  spec: {
    format: "json",
    summary: "Hello World",
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

4. **Run the server**

```bash
bun run index.ts
```

Visit [http://localhost:3000](http://localhost:3000) to see your API documentation!

## Documentation

📚 **[Complete Documentation](./docs/index.md)**

## Example API

Check out the [`/example`](./example/) directory for a complete working API that demonstrates:

- **Health Check Endpoint** (`/healthz`): Simple health check with echo functionality
- **Users API** (`/users`): Full CRUD operations with filtering and pagination
- **Dynamic Routes** (`/users/[id]`): Path parameters with validation
- **Auto-generated Documentation**: Complete OpenAPI specs with Swagger UI

### Running the Example

```bash
cd example
bun install
bun run dev  # Development with hot reload
```

## Publishing

The package is automatically published to NPM when changes are pushed to the `main` branch with automated:

- Coverage updates and badge generation
- Changelog generation using conventional commits
- NPM publishing with public access
- GitHub releases with generated release notes

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
