import { auth } from "./auth";

/**
 * Optional middleware for route-level authentication
 * Use this for routes that need authentication but aren't under the /protected/ path
 */
export async function requireAuth(request: Request) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session) {
			return new Response("Unauthorized", { status: 401 });
		}

		return { user: session.user, session: session.session };
	} catch (_error) {
		return new Response("Invalid session", { status: 401 });
	}
}
