import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ujdsxzvvgaugypwtugdl.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqZHN4enZ2Z2F1Z3lwd3R1Z2RsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNzQ3NjYsImV4cCI6MjA5MDk1MDc2Nn0.XlWRSUAFTBYq3udqmBSkXI2bA73MlyriC1nWuwP4C7c';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
