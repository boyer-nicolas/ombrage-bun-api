const server = Bun.serve({
  routes: {
    "/healthz": new Response("OK"),

    // Dynamic routes
    "/users/:id": (req) => {
      return new Response(`Hello User ${req.params.id}!`);
    },

    // Per-HTTP method handlers
    "/posts": {
      GET: () => new Response("List posts"),
      POST: async (req) => {
        const body = await req.json();
        return Response.json({ created: true, body });
      },
    },

    "/blog/hello": Response.redirect("/blog/hello/world"),
  },

  // (optional) fallback for unmatched routes:
  // Required if Bun's version < 1.2.3
  fetch() {
    return Response.json({ message: "Not found" }, { status: 404 });
  },
});

console.log(`Server running at ${server.url}`);
