import type { SupabaseMemberInsert } from "./supabase/types";

// --- APPLICATION TYPES ---

export type ParsedFormData = {
  sku: string;
  amount: number;
} & Partial<SupabaseMemberInsert>;

export type Issue = {
  message: string;
  code: IssueCode;
  more: Record<string, unknown>;
};

export type IssueCode =
  | "FETCH_ERROR"
  | "PROFILE_NOT_FOUND"
  | "ORDER_NOT_FOUND"
  | "SKU_UNASSIGNED"
  | "VALIDATION_ERROR";

export type PaypalTransactionSearchResponse = {
  name?: string;
  message?: string;
  debug_id?: string;
  transaction_details?: {
    // not all fields are present in this type
    transaction_info: {
      // not all fields are present in this type
      transaction_id: string;
      transaction_event_code: string;
      transaction_status: "D" | "P" | "S" | "V";
      bank_reference_id?: string;
      instrument_type?: string;
      transaction_subject?: string;
      transaction_initiation_date: string;
      transaction_amount: {
        currency_code: string;
        value: string;
      };
      fee_amount?: {
        currency_code: string;
        value: string;
      };
    };
  }[];
  account_number?: string;
  page?: number;
  total_items?: number;
  total_pages?: number;
  links?: {
    href: string;
    rel: string;
    method?: string;
  }[];
};

export type PaypalTransactionInfo = NonNullable<
  PaypalTransactionSearchResponse["transaction_details"]
>[number]["transaction_info"];

export type MailInOrderData = {
  date: Date;
  first_name: string;
  last_name: string;

  email: string | null;
  phone: string | null;

  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  public: boolean;
  accepts_terms_and_conditions: boolean;

  sku: string;
  amount: string;
  fee: string;

  emergency_contact: string | null;
  emergency_contact_phone: string | null;
};
