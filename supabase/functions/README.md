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
