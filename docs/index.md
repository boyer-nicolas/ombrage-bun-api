---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Ombrage Bun API"
  text: "A File-based routing API framework"
  tagline: Built with Bun, featuring automatic OpenAPI documentation generation
  actions:
    - theme: brand
      text: Getting Started
      link: /getting-started/getting-started
    - theme: alt
      text: Examples
      link: /examples-patterns/examples

features:
  - title: 🚀 File-based Routing
    details: Routes are auto-discovered from your filesystem structure. Simply create a route.ts file and your endpoint is ready.
  - title: 📖 Auto-generated Docs
    details: Swagger UI and OpenAPI 3.1 specifications are automatically generated from your route definitions and Zod schemas.
  - title: 🛡️ Type-safe Validation
    details: Built with TypeScript and Zod for runtime validation, type safety, and excellent developer experience.
---

<br/>

# Documentation

## Getting Started

- **[Getting Started](/getting-started/getting-started)** - Installation, setup, and your first route
- **[Routing Guide](/getting-started/routing)** - File-based routing patterns and best practices

## Core Concepts

- **[Route Parameters](/core-concepts/parameters)** - Path, query, body, and header parameter validation with Zod
- **[Configuration](/core-concepts/configuration)** - Server configuration options and environment variables
- **[OpenAPI Integration](/core-concepts/openapi)** - Automatic documentation generation and Swagger UI
- **[Proxy Configuration](/core-concepts/proxy)** - Advanced proxy setup and configuration

## Examples & Patterns

- **[Examples](/examples-patterns/examples)** - Common patterns, CRUD operations, authentication, and file uploads

## Additional Resources

- **[GitHub Repository](https://github.com/boyer-nicolas/ombrage-bun-api)** - Source code and issues
- **[NPM Package](https://www.npmjs.com/package/ombrage-bun-api)** - Package information and releases
