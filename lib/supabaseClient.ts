import { createClient } from '@supabase/supabase-js';

// TODO: Para produção, estas chaves devem ser movidas para variáveis de ambiente seguras.
// Elas estão fixas no código para conveniência de desenvolvimento neste ambiente.
const supabaseUrl = 'https://zmgwuttcqmpyonvtjprw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZ3d1dHRjcW1weW9udnRqcHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2Nzg2NjAsImV4cCI6MjA3NDI1NDY2MH0.IVpZfKrZUTQ6x9gfkBzV9t6NxSuUbmVnOAIn8AU3CfY';

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("URL do Supabase ou Chave Anon estão ausentes.");
}

// Create and export the Supabase client instance directly.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
