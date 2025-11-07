// Configuration file to handle environment variables safely
export const getConfig = () => {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined' && window.importMetaEnv) {
    return {
      supabaseUrl: window.importMetaEnv.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL',
      supabaseAnonKey: window.importMetaEnv.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'
    };
  }
  
  // Check if import.meta.env is available
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return {
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL',
      supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'
    };
  }
  
  // Fallback values
  return {
    supabaseUrl: 'YOUR_SUPABASE_URL',
    supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY'
  };
};