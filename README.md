# File-based Router Framework

[Documentation](./docs/index.md)

A powerful file-based routing system built with Bun, featuring automatic API documentation generation with Swagger UI.

## Features

- 🚀 **File-based routing**: Routes auto-discovered from filesystem structure
- 📁 **Structured organization**: Separate `route.ts`, `service.ts`, and `spec.ts` files
- 📖 **Auto-generated docs**: Swagger UI with OpenAPI 3.0 specifications
- 🔄 **Hot reload**: Development server with instant updates
- 🛡️ **JSON error responses**: Consistent error handling with structured responses

## Installation

```bash
bun install
```

## Development

```bash
bun run dev
```

## API Documentation

Once the server is running, visit:

- **Swagger UI**: http://localhost:3000
- **OpenAPI JSON**: http://localhost:3000/api-docs.json
- **Health Check**: http://localhost:3000/healthz

## Creating Routes

1. **Create a directory** under `routes/` (e.g., `routes/users/profile/`)
2. **Add route handlers** in `route.ts`:

   ```typescript
   import { createRoute } from "@lib/helpers";
   import { getProfile } from "@routes/users/profile/service";
   import spec from "@routes/users/profile/spec";

   export const GET = createRoute({
     method: "GET",
     callback: async () => {
       const profile = await getProfile();
       return Response.json(profile);
     },
     spec: spec.get,
   });
   ```

3. **Add business logic** in `service.ts`:

   ```typescript
   export async function getProfile() {
     return { id: 1, name: "John Doe" };
   }
   ```

4. **Add API documentation** in `spec.ts`:
   ```typescript
   export const profileSpec = {
     get: {
       summary: "Get user profile",
       responses: {
         "200": {
           description: "User profile data",
           content: {
             "application/json": {
               schema: {
                 type: "object",
                 properties: {
                   id: { type: "number" },
                   name: { type: "string" },
                 },
               },
             },
           },
         },
       },
     },
   };
   ```

The route will be automatically available at `/users/profile` with full Swagger documentation!

## Runtime

This project was created using `bun init` in bun v1.3.0. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
