import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/app/api/cron/src/supabase/types";
import { getSupabaseProjectUrl } from "@/lib/supabase-project";

type NewType =
  | "MEMBERSHIP"
  | "FORUM"
  | "DONATION"
  | "REFUND"
  | "UNKNOWN"
  | "HIDDEN";

function adminClient() {
  const url = getSupabaseProjectUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function patchMttOverride(
  admin: ReturnType<typeof adminClient>,
  memberId: number,
  transactionId: number,
  lineItemIndex: number,
  sku: string,
  value: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const payload = { product_type_override: value };

  const trySelect = async () => {
    const { data, error } = await admin
      .from("members_to_transactions")
      .update(payload)
      .eq("member_id", memberId)
      .eq("transaction_id", transactionId)
      .eq("line_item_index", lineItemIndex)
      .select("transaction_id");
    return { data, error };
  };

  let { data, error } = await trySelect();
  if (!error && data && data.length > 0) return { ok: true };
  if (error) return { ok: false, error: error.message };

  if (lineItemIndex === 0) {
    ({ data, error } = await admin
      .from("members_to_transactions")
      .update(payload)
      .eq("member_id", memberId)
      .eq("transaction_id", transactionId)
      .is("line_item_index", null)
      .select("transaction_id"));
    if (!error && data && data.length > 0) return { ok: true };
    if (error) return { ok: false, error: error.message };
  }

  const { data: rows, error: selErr } = await admin
    .from("members_to_transactions")
    .select("line_item_index, sku")
    .eq("member_id", memberId)
    .eq("transaction_id", transactionId);

  if (selErr) return { ok: false, error: selErr.message };

  const sameSku = (rows ?? []).filter((r) => r.sku === sku);
  if (sameSku.length === 1) {
    ({ data, error } = await admin
      .from("members_to_transactions")
      .update(payload)
      .eq("member_id", memberId)
      .eq("transaction_id", transactionId)
      .eq("line_item_index", sameSku[0].line_item_index)
      .select("transaction_id"));
    if (!error && data && data.length > 0) return { ok: true };
    if (error) return { ok: false, error: error.message };
  }

  return {
    ok: false,
    error:
      "No row updated: check members_to_transactions line_item_index / sku, or data is inconsistent.",
  };
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "")?.trim();
    if (!token) {
      return NextResponse.json({ error: "Missing Authorization bearer token" }, { status: 401 });
    }

    const admin = adminClient();
    const { data: authData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !authData.user) {
      console.error("recharacterize-member-transaction auth:", authErr?.message);
      return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
    }

    const body = (await req.json()) as {
      memberId: number;
      transactionId: number;
      lineItemIndex: number;
      newType: NewType;
      lineAmount: number;
      catalogProductType: string;
      sku: string;
    };

    const memberId = Number(body.memberId);
    const transactionId = Number(body.transactionId);
    const lineItemIndex = Number(body.lineItemIndex ?? 0);
    const sku = String(body.sku ?? "").trim();
    const newType = body.newType;
    const lineAmount = Number(body.lineAmount);
    const catalog = String(body.catalogProductType ?? "UNKNOWN")
      .trim()
      .toUpperCase();

    if (
      !Number.isFinite(memberId) ||
      !Number.isFinite(transactionId) ||
      !newType ||
      !sku
    ) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (newType === "REFUND") {
      const { error: txErr } = await admin
        .from("transactions")
        .update({
          refunded_amount: lineAmount,
          fulfillment_status: "CANCELED",
        })
        .eq("id", transactionId);

      if (txErr) {
        return NextResponse.json({ error: txErr.message }, { status: 400 });
      }

      const mtt = await patchMttOverride(
        admin,
        memberId,
        transactionId,
        lineItemIndex,
        sku,
        null,
      );
      if (!mtt.ok) {
        return NextResponse.json({ error: mtt.error ?? "MTT update failed" }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    const newOverride = newType === catalog ? null : newType;
    const mtt = await patchMttOverride(
      admin,
      memberId,
      transactionId,
      lineItemIndex,
      sku,
      newOverride,
    );
    if (!mtt.ok) {
      return NextResponse.json({ error: mtt.error ?? "MTT update failed" }, { status: 400 });
    }

    const { data: txRow } = await admin
      .from("transactions")
      .select("refunded_amount, fulfillment_status")
      .eq("id", transactionId)
      .maybeSingle();

    const hadRefund =
      (txRow?.refunded_amount ?? 0) > 0 ||
      txRow?.fulfillment_status === "CANCELED";

    if (hadRefund) {
      await admin
        .from("transactions")
        .update({ refunded_amount: 0, fulfillment_status: "FULFILLED" })
        .eq("id", transactionId);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("recharacterize-member-transaction:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
