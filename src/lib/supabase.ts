import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing. Please check your .env file.");
}

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any;

export type Contact = {
  id: string;
  display_name: string;
  raw_phone: string;
  normalized_phone: string;
  whatsapp_phone?: string;
  governorate?: string;
  category?: string;
  validity_status: 'valid' | 'invalid';
  duplicate_status: boolean;
  ready_to_send: boolean;
  created_at: string;
};

export type Template = {
  id: string;
  name: string;
  content: string;
  created_at: string;
};

export type Message = {
  id: string;
  contact_id: string;
  normalized_phone: string;
  message: string;
  status: 'pending' | 'sent' | 'failed' | 'replied';
  error?: string;
  created_at: string;
  sent_at?: string;
};
