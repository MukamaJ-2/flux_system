/**
 * API Configuration
 * Points at the Supabase Edge Function that serves the Flux REST API on Bolt Cloud.
 * The edge function is mounted at /functions/v1/api; Supabase rewrites that prefix
 * to /api internally, so routes like /api/users/me/ match the Hono app.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
export const API_URL = `${SUPABASE_URL}/functions/v1/api`.replace(/\/$/, '')
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export default { API_URL, SUPABASE_ANON_KEY }
