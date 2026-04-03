import "server-only";
import { convert } from "../processing";
import type {
  Database,
  SupabaseMember,
  SupabaseMemberConflict,
  SupabaseMemberInsert,
  SupabaseMemberTransaction,
  SupabaseMemberTransactionInsert,
  SupabaseMemberUpdate,
  SupabasePayoutInsert,
  SupabaseProduct,
  SupabaseProductInsert,
  SupabaseTransaction,
  SupabaseTransactionInsert,
} from "./types";
import { createClient } from "@supabase/supabase-js";

// THIS IS SUPER SECRET SERVICE KEY!
// DO NOT USE UNLESS YOU WANT USER TO HAVE READ/WRITE ACCESS TO ALL DATA
// NEVER USE ON CLIENT SIDE, ONLY SERVER SIDE
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

export const get = {
  last_sync: async () => {
    const { data, error } = await supabase
      .from("last_updated")
      .select()
      .eq("table_name", "transactions");

    if (error)
      throw new Error(
        `Failed to get last updated time for transactions. ${error.hint}`,
      );

    return new Date(data[0].last_sync);
  },

  all_users_matching: async (
    member: SupabaseMemberInsert,
  ): Promise<SupabaseMember[]> => {
    const { data, error } = await supabase.rpc("get_normalized_member", {
      _first_name: member.first_name,
      _last_name: member.last_name,
      _email: member.email ?? "",
      _phone: member.phone ?? "",
    });

    if (error)
      throw new Error(
        `Failed to get supabase members. ${error.hint}. ${error.message}`,
      );

    return data;
  },

  products: async (): Promise<SupabaseProduct[]> => {
    const { data, error } = await supabase.from("products").select();

    if (error)
      throw new Error(
        `Failed to get supabase products. ${error.hint}. ${error.message}`,
      );

    return data;
  },

  member_transactions: async (
    transaction_id: number,
    line_item_index: number,
  ): Promise<SupabaseMemberTransaction[]> => {
    const { data, error } = await supabase
      .from("members_to_transactions")
      .select()
      .eq("transaction_id", transaction_id)
      .eq("line_item_index", line_item_index);

    if (error)
      throw new Error(
        `Failed to get supabase member transactions. ${error.hint}. ${error.message}`,
      );

    return data;
  },

  users_with_email: async (email: string): Promise<SupabaseMember[]> => {
    const { data, error } = await supabase
      .from("members")
      .select()
      .order("id", { ascending: true })
      .eq("email", email.toLowerCase());

    if (error)
      throw new Error(
        `Failed to get supabase members. ${error.hint}. ${error.message}`,
      );

    return data;
  },
};

export const upsert = {
  transactions: async (
    transactionsToUpsert: SupabaseTransactionInsert[],
  ): Promise<SupabaseTransaction[]> => {
    const { error, data } = await supabase
      .from("transactions")
      .upsert(transactionsToUpsert, { onConflict: "sqsp_transaction_id" })
      .select();

    if (error)
      throw new Error(
        `Failed to upsert transactions. ${error.hint}. ${error.message}`,
      );

    return data;
  },

  products: async (
    productsToUpsert: SupabaseProductInsert[],
  ): Promise<SupabaseProduct[]> => {
    const { error, data } = await supabase.rpc("upsert_products", {
      _products: productsToUpsert,
    });

    if (error)
      throw new Error(
        `Failed to upsert products. ${error.hint}. ${error.message}`,
      );

    return data;
  },

  member_transaction: async (
    mt: SupabaseMemberTransactionInsert,
  ): Promise<SupabaseMemberTransaction[]> => {
    const { data, error } = await supabase
      .from("members_to_transactions")
      .upsert(mt, {
        onConflict: "member_id,transaction_id,line_item_index",
      })
      .select();

    if (error) {
      throw new Error(
        `Failed to insert member-to-transaction mapping with data ${JSON.stringify(
          mt,
        )}: ${error.message}`,
      );
    }

    return data;
  },

  payouts: async (payoutsToUpsert: SupabasePayoutInsert[]) => {
    if (payoutsToUpsert.length === 0) return;

    // Avoid PostgREST ambiguity when both upsert_payouts(json) and upsert_payouts(jsonb) exist.
    const batchSize = 200;
    for (let i = 0; i < payoutsToUpsert.length; i += batchSize) {
      const batch = payoutsToUpsert.slice(i, i + batchSize);
      const { error } = await supabase.from("payouts").upsert(batch, {
        onConflict: "payment_platform,payout_id",
      });

      if (error)
        throw new Error(
          `Failed to upsert payouts. ${error.hint ?? ""} ${error.message}`,
        );
    }
  },
};

export const update = {
  last_sync: async (time: Date) => {
    const { error } = await supabase
      .from("last_updated")
      .update({ last_sync: time.toISOString() })
      .eq("table_name", "transactions");

    if (error)
      throw new Error(
        `Failed to update last sync time for transactions. ${error.hint}. ${error.message}`,
      );
  },

  users_given_transactions: async (ts: SupabaseTransaction[]) => {
    const new_members: SupabaseMember[] = [];

    const products = await get.products();
    const sku_map = new Map(products.map((p) => [p.sku, p]));

    for (const t of ts) {
      // Skip transactions that are marked as fulfilled because it means they are test transactions (except for squarespace donations)
      if (
        t.fulfillment_status === "FULFILLED" &&
        !t.skus.some((sku) => sku === "SQDONATION")
      )
        continue;

      if (t.fulfillment_status === "CANCELED") continue;

      for (const [line_item, data] of t.parsed_form_data.entries()) {
        const { data: mem, error } = convert.member(data);

        if (error) {
          continue;
        }

        if (!sku_map.get(data.sku)) {
          const created_product = await upsert.products([
            convert.product({
              sku: data.sku,
              descriptor: "Unknown Product",
              variantId:
                "This SKU was not found in the current squarespace products nor our Supabase database, however it exists in the squarespace transactions API",
              isUnlimited: false,
              quantity: 0,
            }),
          ]);
          sku_map.set(data.sku, created_product[0]);
        }

        const matches = (await get.all_users_matching(mem))
          .sort((a, b) => a.id - b.id)
          .filter((match) => perform.is_user_subset(match, mem));

        const existing_mt = await get.member_transactions(t.id, line_item);

        const product = sku_map.get(data.sku);

        if (matches.length > 0) {
          if (existing_mt.length === 0) {
            await upsert.member_transaction({
              member_id: matches[0].id,
              transaction_id: t.id,
              line_item_index: line_item,
              amount: data.amount,
              sku: data.sku,
            });
          }

          await update.member(matches[0].id, {
            ...matches[0],
            type: product?.type === "MEMBERSHIP" ? "MEMBER" : matches[0].type,
            emergency_contact:
              mem.emergency_contact ?? matches[0].emergency_contact,
            emergency_contact_phone:
              mem.emergency_contact_phone ?? matches[0].emergency_contact_phone,
            phone: matches[0].phone ?? mem.phone,
            email: matches[0].email ?? mem.email,
            member_status:
              product?.type === "MEMBERSHIP" && product?.status
                ? product?.status
                : matches[0].member_status,
            public:
              product?.type === "MEMBERSHIP"
                ? (mem.public ?? matches[0].public)
                : matches[0].public,
            expiration_date:
              product?.type === "MEMBERSHIP" && product?.year
                ? `08/31/20${product.year.replace(/\D/, "").slice(2)}`
                : matches[0].expiration_date,
          });
        } else {
          const new_mem = {
            ...mem,
            type:
              product?.type === "MEMBERSHIP"
                ? ("MEMBER" as const)
                : ("NONMEMBER" as const),
            member_status:
              product?.type === "MEMBERSHIP" && product?.status
                ? product?.status
                : undefined,
            public: product?.type === "MEMBERSHIP" ? mem.public : undefined,
            expiration_date:
              product?.type === "MEMBERSHIP" && product?.year
                ? `08/31/20${product.year.replace(/\D/, "").slice(2)}`
                : undefined,
          };

          const created_mem = await insert.member(new_mem);

          if (existing_mt.length === 0) {
            await upsert.member_transaction({
              member_id: created_mem.id,
              transaction_id: t.id,
              line_item_index: line_item,
              amount: data.amount,
              sku: data.sku,
            });
          }

          new_members.push(created_mem);
        }
      }
    }

    return new_members;
  },

  member_conflicts: async (
    mc: Omit<SupabaseMemberConflict, "created_at" | "updated_at">,
  ) => {
    const { error, data } = await supabase
      .from("member_conflicts")
      .update(mc)
      .eq("first_member_id", mc.first_member_id)
      .eq("second_member_id", mc.second_member_id)
      .select();

    if (error)
      throw new Error(
        `Failed to upsert member conflicts. ${error.hint}. ${error.message}`,
      );

    return data[0];
  },

  member: async (id: number, m: SupabaseMemberUpdate) => {
    delete m.id;
    delete m.created_at;
    delete m.updated_at;

    const { error, data } = await supabase
      .from("members")
      .update(m)
      .eq("id", id)
      .select();

    if (error)
      throw new Error(
        `Failed to update member. ${error.hint}. ${error.message}`,
      );

    return data[0];
  },

  payout: async (
    date_adjusted: string,
    received: boolean,
    payment_platform: "PAYPAL" | "STRIPE",
  ) => {
    const { data, error } = await supabase
      .from("payouts")
      .update({ received })
      .eq("date_adjusted", date_adjusted)
      .eq("payment_platform", payment_platform)
      .select();

    if (error)
      throw new Error(
        `Failed to update payout. ${error.hint}. ${error.message}`,
      );

    return data[0];
  },
};

export const insert = {
  member: async (m: SupabaseMemberInsert): Promise<SupabaseMember> => {
    const member = { ...m, sku: undefined, amount: undefined };
    const { error, data } = await supabase
      .from("members")
      .insert(member)
      .select();

    if (error)
      throw new Error(
        `Failed to insert new member. ${error.hint}. ${error.message}`,
      );

    return data[0];
  },

  product: async (p: SupabaseProductInsert): Promise<SupabaseProduct> => {
    const { error, data } = await supabase.from("products").insert(p).select();

    if (error)
      throw new Error(
        `Failed to insert new product. ${error.hint}. ${error.message}`,
      );

    return data[0];
  },

  transaction: async (
    t: SupabaseTransactionInsert,
  ): Promise<SupabaseTransaction> => {
    const { error, data } = await supabase
      .from("transactions")
      .insert(t)
      .select();

    if (error)
      throw new Error(
        `Failed to insert new transaction. ${error.hint}. ${error.message}`,
      );

    return data[0];
  },
};

export const erase = {
  member: async (id: number) => {
    const { error } = await supabase.from("members").delete().eq("id", id);

    if (error)
      throw new Error(
        `Failed to delete member. ${error.hint}. ${error.message}`,
      );
  },
};

export const perform = {
  calculate_member_conflicts: async () => {
    const { error } = await supabase.rpc("populate_member_conflicts");

    if (error)
      throw new Error(
        `Failed to populate member conflicts. ${error.hint}. ${error.message}`,
      );
  },

  is_user_subset: (
    existingMember: SupabaseMember,
    newMemberData: SupabaseMemberInsert,
  ) => {
    const keys = Object.keys(newMemberData) as (keyof SupabaseMemberInsert)[];

    for (const key of keys) {
      if (
        typeof existingMember[key] === "string" &&
        typeof newMemberData[key] === "string" &&
        key !== "type" &&
        key !== "updated_at" &&
        key !== "created_at" &&
        key !== "id"
      ) {
        if (
          existingMember[key].toLowerCase() !== newMemberData[key].toLowerCase()
        ) {
          return false;
        }
      }
    }
    return true;
  },

  resolve_member_conflict_merge: async (
    prev_member_id: number,
    updated_member_id: number,
    merged_member: SupabaseMemberUpdate,
  ) => {
    const { error } = await supabase.rpc("resolve_member_conflict_merge", {
      p_first_member_id: prev_member_id,
      p_second_member_id: updated_member_id,
      p_merged_member: merged_member,
    });

    if (error)
      throw new Error(
        `Failed to resolve member conflict in merge. ${error.hint ? error.hint + ". " : ""}${error.message ? error.message : ""}`,
      );
  },
};
