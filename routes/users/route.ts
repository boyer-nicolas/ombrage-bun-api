import { createRoute } from "@lib/helpers";
import { createUser, listUsers } from "@routes/users/service";
import spec from "@routes/users/spec";

export const GET = createRoute({
	method: "GET",
	callback: async () => {
		const users = await listUsers();
		return Response.json(users);
	},
	spec: spec.get,
});

export const POST = createRoute({
	method: "POST",
	callback: async ({ request }) => {
		const body: { name: string } = (await request.json()) as { name: string };
		const user = await createUser(body.name);
		return Response.json({ name: user }, { status: 201 });
	},
	spec: spec.post,
});
