export class RouteInterface<T> {
  protected service: T;
  constructor(service: T) {
    this.service = service;
  }

  public GET?: (request: Request) => Promise<Response>;
  public POST?: (request: Request) => Promise<Response>;
  public PUT?: (request: Request) => Promise<Response>;
  public DELETE?: (request: Request) => Promise<Response>;
  public PATCH?: (request: Request) => Promise<Response>;
}
