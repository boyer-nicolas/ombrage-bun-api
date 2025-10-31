import { z } from "zod";

export const listSchema = z.array(z.string());

export const createSchema = z.object({
	name: z.string().min(1).max(255),
});
