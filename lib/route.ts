export type RouteProps = {
	request: Request;
	validator?: unknown;
};

export class Route<T> {
	protected service: T;

	constructor(service: T) {
		this.service = service;
	}

	public GET?: ({ request }: { request: Request }) => Promise<Response>;
	public POST?: ({ request }: { request: Request }) => Promise<Response>;
	public PUT?: ({ request }: { request: Request }) => Promise<Response>;
	public DELETE?: ({ request }: { request: Request }) => Promise<Response>;
	public PATCH?: ({ request }: { request: Request }) => Promise<Response>;
}
