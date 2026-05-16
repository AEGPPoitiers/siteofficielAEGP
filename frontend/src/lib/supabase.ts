import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables d\'environnement Supabase manquantes. ' +
      'Copie frontend/.env.example vers frontend/.env et remplis les valeurs.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
