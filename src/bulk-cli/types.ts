export type Recipient = {
  phone: string;
  name?: string;
  governorate?: string;
  category?: string;
  opt_in?: string | boolean;
};

export type SendStatus =
  | 'sent'
  | 'failed'
  | 'skipped_optout'
  | 'skipped_no_optin'
  | 'skipped_invalid_phone'
  | 'skipped_resume';

export type SendLogEntry = {
  timestamp: string;
  phone_input: string;
  phone_normalized: string | null;
  phone_sent: string | null;
  template_id_or_hash: string;
  message_preview: string;
  status: SendStatus;
  http_status: number | null;
  message_id: string | null;
  error: string | null;
};

export type SendResult = {
  success: boolean;
  status: SendStatus;
  httpStatus: number | null;
  messageId: string | null;
  error: string | null;
};
