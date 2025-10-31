export async function listUsers() {
	return ["user1", "user2", "user3"];
}

export async function createUser(name: string) {
	return { name, created: true };
}
