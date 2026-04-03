import { convert } from "../src/processing";
import { upsert } from "../src/supabase/api";
import { apiResponse, toISO } from "../src/utils";
import { Temporal } from "temporal-polyfill";
import Stripe from "stripe";
import type {
  PaypalTransactionInfo,
  PaypalTransactionSearchResponse,
} from "../src/types";

export async function POST() {
  return apiResponse(async () => {
    const stripeRows = await api.stripe.payouts();
    const paypalRows = await api.paypal.payouts();

    await upsert.payouts(stripeRows.map(convert.payouts.stripe));
    await upsert.payouts(paypalRows.map(convert.payouts.paypal));

    return Response.json({
      message: `Upserted ${stripeRows.length} stripe payouts and ${paypalRows.length} paypal payouts`,
    });
  });
}

const api = {
  stripe: {
    payouts: async () => {
      const stripe_key = process.env.STRIPE_SECRET_KEY;

      if (!stripe_key) {
        throw new Error("STRIPE_SECRET_KEY is not set");
      }

      const stripe = new Stripe(stripe_key);

      const stripe_payouts: Stripe.Payout[] = [];
      let res = await stripe.payouts.list({ limit: 100 });

      stripe_payouts.push(...res.data);
      while (res.has_more) {
        res = await stripe.payouts.list({
          limit: 100,
          starting_after: res.data.at(-1)!.id,
        });

        stripe_payouts.push(...res.data);
      }

      return stripe_payouts;
    },
  },
  paypal: {
    payouts: async () => {
      const token = await api.paypal.token();

      const paypal_payouts: PaypalTransactionInfo[] = [];

      // api only has data for last 3 years. check paypal docs for this
      let start_date = Temporal.Now.zonedDateTimeISO("UTC").add({
        years: -2,
        days: -364,
      });

      while (
        Temporal.ZonedDateTime.compare(
          start_date,
          Temporal.Now.zonedDateTimeISO("UTC"),
        ) < 0
      ) {
        const res = await fetch(
          `https://api-m.paypal.com/v1/reporting/transactions?start_date=${toISO(start_date)}&end_date=${toISO(start_date.add({ days: 31 }))}&page_size=500`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const data = (await res.json()) as PaypalTransactionSearchResponse;

        if (!res.ok) {
          const msg =
            typeof data === "object" && data !== null && "message" in data
              ? String((data as { message?: string }).message)
              : res.statusText;
          throw new Error(`PayPal reporting API error (${res.status}): ${msg}`);
        }

        const details = data.transaction_details ?? [];

        paypal_payouts.push(
          ...details
            .filter((t) =>
              t.transaction_info.transaction_event_code.startsWith("T04"),
            )
            .map((t) => t.transaction_info),
        );

        start_date = start_date.add({ days: 31 });
      }

      return paypal_payouts;
    },

    token: async () => {
      const paypal_client_id = process.env.PAYPAL_CLIENT_ID;
      const paypal_secret = process.env.PAYPAL_SECRET_KEY;

      if (!paypal_client_id || !paypal_secret) {
        throw new Error("PAYPAL_CLIENT_ID or PAYPAL_SECRET_KEY is not set");
      }

      const res = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${paypal_client_id}:${paypal_secret}`,
          ).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to get paypal token");
      }

      const data = await res.json();
      return data.access_token;
    },
  },
};
