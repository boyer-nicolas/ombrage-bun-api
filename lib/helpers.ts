import type { OpenAPIV3_1 } from "openapi-types";

export function defineSpec(
	spec: OpenAPIV3_1.PathsObject,
): OpenAPIV3_1.PathsObject {
	return spec;
}
export type RouteProps = {
	request: Request;
	validator?: unknown;
};

export type CreateRouteProps = {
	method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
	callback?: (props: RouteProps) => Promise<Response>;
};

export function createRoute({ method, callback }: CreateRouteProps) {
	return { method, callback };
}
