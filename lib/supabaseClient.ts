import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
    // If client is already created, return it
    if (supabase) {
        return supabase;
    }

    const supabaseUrl = "https://zmgwuttcqmpyonvtjprw.supabase.co";
    const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZ3d1dHRjcW1weW9udnRqcHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2Nzg2NjAsImV4cCI6MjA3NDI1NDY2MH0.IVpZfKrZUTQ6x9gfkBzV9t6NxSuUbmVnOAIn8AU3CfY";

    if (supabaseUrl && supabaseAnonKey) {
        try {
            supabase = createClient(supabaseUrl, supabaseAnonKey);
            return supabase;
        } catch (error) {
            console.error("Error creating Supabase client:", error);
            return null;
        }
    }
    
    // If credentials are not available, return null.
    // The UI will then show the ApiConfigPage to prompt the user.
    return null;
};
