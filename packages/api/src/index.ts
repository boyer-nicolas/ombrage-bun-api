// Main export file for the Koritsu
import { Api, type KoritsuServer } from "./lib/api";
import {
	type Config,
	ConfigSchema,
	getConfig,
	type ProxyConfig,
	type ProxyHandler,
} from "./lib/config";
import {
	type CreateRouteProps,
	createRoute,
	createRouteCollection,
	createTypedResponse,
	type RouteDefinition,
	type RouteProps,
} from "./lib/helpers";
import { FileRouter } from "./lib/router";

export {
	Api,
	ConfigSchema,
	type Config,
	getConfig,
	type RouteProps,
	type CreateRouteProps,
	type RouteDefinition,
	type KoritsuServer,
	type ProxyHandler,
	type ProxyConfig,
	createTypedResponse,
	createRoute,
	createRouteCollection,
	FileRouter,
};
