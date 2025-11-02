# Configuration Options
## Through Environment Variables

The following environment variables can be used to configure the application:

- **PORT**: `number`

- **HOST**: `string`

- **LOG_LEVEL**: `"debug" | "info" | "warn" | "error"`

- **SWAGGER_ENABLED**: `boolean`

- **SWAGGER_PATH**: `string`

- **API_TITLE**: `string`

- **API_DESCRIPTION**: `string`

- **AUTH_ENABLED**: `boolean`

- **AUTH_SECRET**: `string`

- **ENVIRONMENT**: `"development" | "production" | "test"`

## Through AppConfig

You can also configure the application using the `AppConfig` class:

```ts
import { Server } from 'ombrage-bun-api';

new Server({
  "server": {
    "port": 8080,
    "host": "0.0.0.0",
    "logLevel": "debug",
    "routesDir": "./routes"
  },
  "swagger": {
    "enabled": true,
    "path": "/"
  },
  "title": "My API",
  "description": "Auto-generated API documentation from route specifications",
  "auth": {
    "enabled": false,
    "secret": "changeme"
  },
  "environment": "development"
}).start();

// Server is now configured with the above options
```
