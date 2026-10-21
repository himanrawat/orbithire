/** Discovery documents: RFC 9728 (protected resource) and RFC 8414 (authorization server). */
import {
	AUTHORIZE_PATH,
	REGISTER_PATH,
	REVOKE_PATH,
	SUPPORTED_SCOPES,
	TOKEN_PATH,
	issuerFor,
	mcpResourceFor,
} from "./config";

export function protectedResourceMetadata(req: Request) {
	const issuer = issuerFor(req);
	return {
		resource: mcpResourceFor(req),
		authorization_servers: [issuer],
		scopes_supported: [...SUPPORTED_SCOPES],
		bearer_methods_supported: ["header"],
		resource_name: "OrbitHire",
		resource_documentation: `${issuer}/settings`,
	};
}

export function authorizationServerMetadata(req: Request) {
	const issuer = issuerFor(req);
	return {
		issuer,
		authorization_endpoint: issuer + AUTHORIZE_PATH,
		token_endpoint: issuer + TOKEN_PATH,
		registration_endpoint: issuer + REGISTER_PATH,
		revocation_endpoint: issuer + REVOKE_PATH,
		scopes_supported: [...SUPPORTED_SCOPES],
		response_types_supported: ["code"],
		response_modes_supported: ["query"],
		grant_types_supported: ["authorization_code", "refresh_token"],
		token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
		revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
		code_challenge_methods_supported: ["S256"],
		client_id_metadata_document_supported: true,
		authorization_response_iss_parameter_supported: true,
		service_documentation: `${issuer}/settings`,
	};
}
