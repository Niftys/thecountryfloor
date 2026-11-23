/** Synthetic Auth email for username/password logins (shared by client + admin). */
export function authEmailForUsername(username: string) {
  return `${username.trim().toLowerCase()}@users.thecountryfloor.local`;
}
