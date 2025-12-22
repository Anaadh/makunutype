import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create a dummy client or handle invalid configuration gracefully
const isConfigured = supabaseUrl && supabaseUrl !== 'YOUR_SUPABASE_URL' && supabaseAnonKey && supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY';

export const supabase = isConfigured
    ? createClient(supabaseUrl, supabaseAnonKey)
    : {
        from: () => ({
            select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }) }) }) }) }),
            insert: () => Promise.resolve({ error: new Error('Supabase not configured') })
        })
    } as any;
