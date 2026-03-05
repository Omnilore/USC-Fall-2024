import { supabase } from "@/app/supabase";
import { Database } from "./api/cron/src/supabase/types";

export type TableName = keyof Database["public"]["Tables"] | "audit_logs";

export const queryTableWithPrimaryKey = async (
  table: TableName, options?: { includeServiceLogs?: boolean; limit?: number},
): Promise<{ data: any[]; primaryKeys: string[] }> => {
  console.log(`Querying table: ${table}`);

  const limit = options?.limit ?? 1000;


  // Fetch the table content
  //
  //const { data, error } = await supabase.from(table).select("*");
  let query = supabase.from(table).select("*");

  if (table === "audit_logs") {
    if (options?.includeServiceLogs === false) {
      query = query.neq("source", "service");
    }

    query = query
      .order("recorded_at", { ascending: false })
      .range(0, limit - 1);
  }

  // // Special handling for audit_logs
  // if (table === "audit_logs") {
  //   query = query.order("recorded_at", { ascending: false });

  //   // newest 1000 non-service logs
  //   if (options?.includeServiceLogs === false) {
  //     query = query.neq("source", "service");
  //   }
  //   // newest 1000 rows after applying filtering
  //   query = query.range(0, 999);
  // }

  const { data, error } = await query;

  if (error) {
    console.error(`Error fetching data from table ${table}:`, error);
    throw error;
  }

  console.log(`Fetched ${data?.length ?? 0} records from table ${table}`);

  // Fetch the primary key information
  const { data: primaryKeyData, error: primaryKeyError } = await supabase.rpc(
    "get_primary_key",
    { table_name: table },
  );

  if (primaryKeyError) {
    console.error(
      `Error fetching primary keys for table ${table}:`,
      primaryKeyError,
    );
    throw primaryKeyError;
  }

  // Ensure primary keys are returned as an array
  const primaryKeys = primaryKeyData?.map((row: any) => row.primary_key) ?? [];

  console.log("primary keys ", primaryKeys);

  return { data: data ?? [], primaryKeys };
};

export const queryTableWithFields = async (
  table: TableName,
  schema: Record<string, any>,
): Promise<{ data: Record<string, any>[]; primaryKey: string | null }> => {
  try {
    console.log(`Querying table: ${table} with selected fields...`);

    // Extract field names from schema and ensure "public" is included
    const selectedFields = [...Object.keys(schema), "public"]
      .filter((value, index, self) => self.indexOf(value) === index) // Ensure uniqueness
      .join(", ");

    // Fetch only the required fields from the table
    const { data, error } = await supabase
      .from(table)
      .select(selectedFields)
      .order("id", { ascending: true });

    if (error || !data) {
      console.error(`Error fetching data from table ${table}:`, error);
      throw error;
    }

    console.log(`Fetched ${data.length} records from table ${table}`);

    // Fetch primary key information
    const { data: primaryKeyData, error: primaryKeyError } = await supabase.rpc(
      "get_primary_key",
      { table_name: table },
    );

    if (primaryKeyError || !primaryKeyData) {
      console.error(
        `Error fetching primary key for table ${table}:`,
        primaryKeyError,
      );
      throw primaryKeyError;
    }

    const primaryKey = primaryKeyData?.[0]?.primary_key ?? null;

    // Remove rows where `public` is false
    const filteredData = data
      .filter((record: Record<string, any>) => record.public !== false)
      .map((record: Record<string, any>) => {
        const filteredRecord = { ...record };
        delete filteredRecord.public; // Remove `public` field from returned data
        return filteredRecord;
      });

    return { data: filteredData, primaryKey };
  } catch (error) {
    console.error(`Error in queryTableWithFields for table ${table}:`, error);
    return { data: [], primaryKey: null };
  }
};

export const getProducts = async () => {
  const { data, error } = await supabase
    .from("products")
    .select()
    .eq("is_current", true);

  if (error) {
    console.error(`Error fetching products:`, error);
    throw error;
  }

  return data;
};
