# Configuration Options

This document outlines the available configuration options for the Koritsu server. You can configure the server using environment variables or by providing a configuration object when initializing the server.


You can also configure the application using the `AppConfig` class:

```ts
import { Server } from 'koritsu';

new Server({
  "server": {
    "port": 8080,
    "host": "0.0.0.0",
    "logLevel": "info",
    "routes": {
      "dir": "./routes",
      "basePath": "/"
    },
    "static": {
      "dir": "./static",
      "enabled": false,
      "basePath": "/static"
    }
  },
  "proxy": {
    "enabled": false,
    "configs": []
  },
  "cors": {
    "enabled": false,
    "origin": "*",
    "methods": [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "HEAD",
      "OPTIONS"
    ],
    "allowedHeaders": [
      "Content-Type",
      "Authorization"
    ],
    "credentials": false,
    "maxAge": 3600,
    "optionsSuccessStatus": 204
  },
  "swagger": {
    "enabled": true,
    "path": "/"
  },
  "title": "My API",
  "description": "Auto-generated API documentation from route specifications",
  "environment": "development"
}).start();

// Server is now configured with the above options
```
