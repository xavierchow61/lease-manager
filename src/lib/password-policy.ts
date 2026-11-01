/** Shared floor for newly chosen passwords. Keep every password-change path on this value. */
export const MIN_PASSWORD_LENGTH = 4;

/** Lifetime of the forced-reset token issued after a successful current-password check. */
export const PASSWORD_CHANGE_TOKEN_TTL_SECONDS = 10 * 60;
