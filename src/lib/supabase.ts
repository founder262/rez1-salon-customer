import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Immediately check and clean up stale/invalid session to prevent repeating console errors
supabase.auth.getSession().then(({ error }) => {
  if (error && (error.message?.includes("Invalid Refresh Token") || error.message?.includes("Refresh Token Not Found") || error.status === 400)) {
    console.warn("Stale or invalid Supabase session detected. Clearing auth storage.");
    supabase.auth.signOut().catch(() => {});
  }
}).catch(() => {});

// Helper: get current logged-in customer ID
export const getCurrentCustomerId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
};
