import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/app/api/cron/src/supabase/types";

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Authorization Bearer token required" },
      { status: 401 },
    );
  }

  const supabase = createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: auth } },
  });

  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table");

  console.log("Getting values from table", table);

  if (!table) {
    return NextResponse.json({ error: "Table is required" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase.from(table as never).select("*");
    if (error) {
      console.error(`Failed to fetch data for table ${table}:`, error.message);
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error(`Failed to fetch data for table ${table}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 },
    );
  }
}
