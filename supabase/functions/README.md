# Supabase Edge Functions

## `create-user`

This function creates an Auth user and the matching records in `users`,
`user_branches`, and `user_permissions`. Only an authenticated, active
`super_admin` can call it.

Deploy it after linking the local repository to the intended Supabase project:

```powershell
supabase functions deploy create-user
```

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed
Edge Functions. Do not put the service-role key in the Vite `.env` file or in
Vercel environment variables.

## `update-user-password`

Changes an existing Auth user's password via `auth.admin.updateUserById`.
Only an authenticated, active `super_admin` can call it. Used by the "Modifier
l'utilisateur" form in Users.jsx when the password field is filled in — a
plain update on the `users` table cannot change an Auth password, it requires
this privileged, service-role call.

```powershell
supabase functions deploy update-user-password
```
