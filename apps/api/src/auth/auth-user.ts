/** What the auth guard attaches to the request after verifying the access token. */
export interface AuthUser {
  id: string;
}

/** Payload of our access tokens (JWT). `sub` is the user id. */
export interface AccessTokenPayload {
  sub: string;
}
