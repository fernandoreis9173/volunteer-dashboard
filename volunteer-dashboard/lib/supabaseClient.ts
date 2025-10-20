import { createClient } from '@supabase/supabase-js';

// Production keys for the application.
const supabaseUrl = 'https://zmgwuttcqmpyonvtjprw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZ3d1dHRjcW1weW9udnRqcHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2Nzg2NjAsImV4cCI6MjA3NDI1NDY2MH0.IVpZfKrZUTQ6x9gfkBzV9t6NxSuUbmVnOAIn8AU3CfY';

// Initialize the client.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
