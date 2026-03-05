import { batchWithDelay, make_data, make_error, type Result } from "./utils";
import type { ParsedFormData, PaypalTransactionInfo } from "./types";
import type {
  SupabaseMemberInsert,
  SupabasePaymentPlatform,
  SupabasePayoutInsert,
  SupabaseProductInsert,
  SupabaseProductType,
  SupabaseTransactionInsert,
} from "./supabase/types";
import type {
  SquarespaceInventoryItem,
  SquarespaceTransactionDocument,
} from "./squarespace/types";
import {
  fetchSquarespaceOrder,
  fetchSquarespaceProfile,
} from "./squarespace/api";
import { parse_form_data } from "./squarespace/form-processor";
import Stripe from "stripe";
import { get } from "./supabase/api";

export const convert = {
  payoutDateAdjusted: (isoDate: string) => {
    return new Date(isoDate).toISOString().slice(0, 7);
  },

  product: (p: SquarespaceInventoryItem): SupabaseProductInsert => {
    let type: SupabaseProductType = "UNKNOWN";
    let year: string | null = null;
    let group_id: string | null = null;

    // Check for Forum SKU: SQF[yy]00[nn]
    const forumMatch = p.sku.match(/^SQF(\d{2})00(\d+)$/);
    if (forumMatch) {
      type = "FORUM";

      const _year = parseInt(forumMatch[1], 10);
      if (_year >= 25) {
        year = `20${_year}`;

        const _group_id = parseInt(forumMatch[2], 10);
        group_id = `${_year}-${Math.trunc(_group_id / 10).toString()}`;
      }
    }

    // Check for Membership SKU: SQM[F|L|A][E|U][yy]00[nn]
    const memMatch = p.sku.match(/^SQM([FLA])([EU])(\d{2})00(\d+)$/);
    if (memMatch) {
      type = "MEMBERSHIP";

      const _year = parseInt(memMatch[3], 10);
      if (_year >= 25) year = `${_year}-${_year + 1}`;
    }

    return {
      sku: p.sku,
      descriptor: p.descriptor,
      sq_id: p.variantId,
      type,
      year,
      group_id,
    };
  },

  transactions: async (
    ts: SquarespaceTransactionDocument[],
  ): Promise<SupabaseTransactionInsert[]> => {
    // Process transactions in batches of 5 with a delay of 1 second between batches
    // Squarespace API has a rate limit of 300 requests per minute
    return batchWithDelay(
      ts,
      (t) =>
        t.salesOrderId
          ? convert.transaction.order(t)
          : convert.transaction.donation(t),
      { batchSize: 5, delayMs: 1000 },
    );
  },

  transaction: {
    order: async (
      t: SquarespaceTransactionDocument,
    ): Promise<SupabaseTransactionInsert> => {
      if (!t.salesOrderId) {
        throw new Error(
          `Transaction has no order ID but must if you want to process as an order. Transactions with no order ID are donations. Transaction ID: ${t.id}`,
        );
      }

      const paymentPlatform = (t.payments.at(0)?.provider as SupabasePaymentPlatform) ?? "MAIL";
      const amount = Number(t.total.value);
      const totalNetPayment = Number(t.totalNetPayment.value);
      const refundedAmount = Number(t.payments.at(0)?.refundedAmount.value ?? 0);

      let fee: number;
      if (refundedAmount > 0 || totalNetPayment <= 0) {
        if (paymentPlatform === "STRIPE") {
          fee = Math.round((amount * 0.029 + 0.30) * 100) / 100;
        } else if (paymentPlatform === "PAYPAL") {
          fee = Math.round(amount * 0.025 * 100) / 100;
        } else {
          fee = 0;
        }
      } else {
        fee = amount - totalNetPayment;
      }

      const order: SupabaseTransactionInsert = {
        sqsp_transaction_id: t.id,
        sqsp_order_id: t.salesOrderId,
        date: t.createdOn,
        amount,
        fee,
        payment_platform: paymentPlatform,
        refunded_amount: refundedAmount,
        external_transaction_id: t.payments.at(0)?.id,
        transaction_email: t.customerEmail,
        fulfillment_status: "UNKNOWN",
        skus: [],
        issues: [],
        raw_form_data: [],
        parsed_form_data: [],
      };

      const { data, error } = await fetchSquarespaceOrder(t.salesOrderId);

      if (error) {
        order.issues.push(
          error.with({
            transaction_id: t.id,
          }),
        );

        return order;
      }

      order.fulfillment_status = data.fulfillmentStatus;
      order.sqsp_id = parseInt(data.orderNumber.replace(/\D/g, ""));
      data.lineItems.forEach((p, idx) => {
        const form_data: [string, string][] = (p.customizations ?? []).map(
          (obj) => [obj.label, obj.value],
        );

        order.raw_form_data.push(Object.fromEntries(form_data));
        order.skus.push(p.sku ?? "SKU_UNASSIGNED");
        if (!p.sku) {
          order.issues.push({
            message: "No SKU assigned",
            code: "SKU_UNASSIGNED",
            more: {
              line_item_idx: idx,
              order_id: t.salesOrderId,
              transaction_id: t.id,
            },
          });
        }

        const result = parse_form_data(form_data);
        if (Object.keys(result.invalid_data).length > 0) {
          order.issues.push({
            message: "Validation errors or warnings",
            code: "VALIDATION_ERROR",
            more: {
              line_item_idx: idx,
              order_id: t.salesOrderId,
              transaction_id: t.id,
              errors: result.invalid_data,
            },
          });
        }

        order.parsed_form_data.push({
          ...result.valid_data,
          sku: p.sku ?? "SKU_UNASSIGNED",
          amount: Number(p.unitPricePaid.value),
        });
      });

      return order;
    },

    donation: async (
      t: SquarespaceTransactionDocument,
    ): Promise<SupabaseTransactionInsert> => {
      if (t.salesOrderId) {
        throw new Error(
          `Transaction has order ID but must NOT if you want to process as a donation. Transactions with order ID are orders. Transaction ID: ${t.id}`,
        );
      }

      const paymentPlatform = (t.payments.at(0)?.provider as SupabasePaymentPlatform) ?? "MAIL";
      const amount = Number(t.total.value);
      const totalNetPayment = Number(t.totalNetPayment.value);
      const refundedAmount = Number(t.payments.at(0)?.refundedAmount.value ?? 0);

      let fee: number;
      if (refundedAmount > 0 || totalNetPayment <= 0) {
        if (paymentPlatform === "STRIPE") {
          fee = Math.round((amount * 0.029 + 0.30) * 100) / 100;
        } else if (paymentPlatform === "PAYPAL") {
          fee = Math.round(amount * 0.025 * 100) / 100;
        } else {
          fee = 0;
        }
      } else {
        fee = amount - totalNetPayment;
      }

      const donation: SupabaseTransactionInsert = {
        sqsp_transaction_id: t.id,
        sqsp_order_id: null,
        date: t.createdOn,
        amount,
        fee,
        refunded_amount: refundedAmount,
        payment_platform: paymentPlatform,
        external_transaction_id: t.payments.at(0)?.id,
        transaction_email: t.customerEmail,
        fulfillment_status: "FULFILLED",
        skus: ["SQDONATION"],
        issues: [],
        raw_form_data: [],
        parsed_form_data: [],
      };

      const { data, error } = await fetchSquarespaceProfile(t.customerEmail);

      if (error?.code === "PROFILE_NOT_FOUND") {
        const users = await get.users_with_email(t.customerEmail);

        if (users.length > 0) {
          donation.raw_form_data.push({});
          donation.parsed_form_data.push({
            sku: "SQDONATION",
            amount: Number(t.total.value),
            first_name: users[0].first_name,
            last_name: users[0].last_name,
            email: users[0].email,
            street_address: users[0].street_address,
            city: users[0].city,
            state: users[0].state,
            zip_code: users[0].zip_code,
          });

          return donation;
        }
      }

      if (error) {
        donation.issues.push(
          error.with({
            transaction_id: t.id,
          }),
        );

        return donation;
      }

      donation.raw_form_data.push({});
      donation.parsed_form_data.push({
        sku: "SQDONATION",
        amount: Number(t.total.value),
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        street_address:
          data.address.address1.trim() +
          (data.address.address2 ? ", " + data.address.address2.trim() : ""),
        city: data.address.city,
        state: data.address.state,
        zip_code: data.address.postalCode,
      });

      return donation;
    },
  },

  member: (d: ParsedFormData): Result<SupabaseMemberInsert> => {
    if (!d.first_name || !d.last_name || (!d.email && !d.phone)) {
      return make_error({
        message: "Member has no name or neither an email or phone",
        code: "VALIDATION_ERROR",
        more: {
          parsed_form_data: d,
        },
      });
    }

    return make_data({
      ...d,
      sku: undefined,
      amount: undefined,
      first_name: d.first_name,
      last_name: d.last_name,
      type: "NONMEMBER",
    });
  },

  payouts: {
    stripe: (data: Stripe.Payout): SupabasePayoutInsert => {
      return {
        amount: data.amount,
        date: new Date(data.created * 1000).toISOString(),
        date_adjusted: convert.payoutDateAdjusted(
          new Date(data.created * 1000).toISOString(),
        ),
        payment_platform: "STRIPE",
        payout_id: data.id,
        status: data.status,
      };
    },

    paypal: (data: PaypalTransactionInfo): SupabasePayoutInsert => {
      return {
        amount: Math.round(Math.abs(Number(data.transaction_amount.value)) * 100),
        date: new Date(data.transaction_initiation_date).toISOString(),
        date_adjusted: convert.payoutDateAdjusted(
          new Date(data.transaction_initiation_date).toISOString(),
        ),
        payment_platform: "PAYPAL",
        payout_id: data.transaction_id,
        status:
          data.transaction_status === "D"
            ? "failed"
            : data.transaction_status === "P"
              ? "pending"
              : data.transaction_status === "S"
                ? "paid"
                : data.transaction_status === "V"
                  ? "void"
                  : "status not found",
      };
    },
  },
};
