import type { Database } from "./api/cron/src/supabase/types";
import { createClient } from "@supabase/supabase-js";
import { TableName } from "./queryFunctions";

// Use environment variables if available (for staging), otherwise use production
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://chhlncecdckfxxdcdzvz.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoaGxuY2VjZGNrZnh4ZGNkenZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY0NDg0MDIsImV4cCI6MjA0MjAyNDQwMn0.T2xvdaxJjyrtOX9_d2i3TqT4NnIMAvPWekwcyfQo7gI",
);

export interface Permission {
  table_name: string;
  can_create: boolean;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

interface TableColumn {
  column_name: string;
  udt_name: string;
  is_nullable: boolean;
}

export async function getRoles() {
  const { error, data } = await supabase.rpc("get_current_user_roles");
  if (error) {
    return null;
  }
  const roles: string[] = data.map((x: any) => x.role);
  return roles;
}

export async function isSignedIn() {
  const { error, data } = await supabase.auth.getUser();
  return !error && data !== null;
}

export async function signOut() {
  await supabase.auth.signOut({ scope: "local" });
}

export const getPermissions = async (role: string): Promise<Permission[]> => {
  const { data, error } = await supabase
    .from("permissions_by_role")
    .select("table_name, can_create, can_read, can_write, can_delete")
    .eq("role_name", role);

  if (error) {
    console.error("Failed to fetch permissions:", error.message);
    return [];
  }

  console.log(`Permissions for role "${role}":`, data);
  return data as Permission[];
};

export const getDataForTable = async (table: TableName) => {
  try {
    const { data, error } = await supabase.from(table).select("*");

    if (error) {
      console.error(`Error fetching data for table ${table}:`, error.message);
      return [];
    }

    return data ?? [];
  } catch (error) {
    console.error(`Unexpected error fetching data for table ${table}:`, error);
    return [];
  }
};

export const getMemberNamesByIds = async (memberIds: string[] | number[]) => {
  if (!memberIds || memberIds.length === 0) return [];
  const { data, error } = await supabase
    .from("members")
    .select("id, first_name, last_name")
    .in("id", memberIds as any);
  if (error) {
    console.error("Failed to fetch member names:", error.message);
    return [];
  }
  return data || [];
};

export const getTableSchema = async (table: string) => {
  try {
    const { data, error } = await supabase.rpc("get_table_columns", {
      table_name: table,
    });
    if (error) {
      console.error(
        `Failed to fetch schema for table ${table}:`,
        error.message,
      );
      return {};
    }
    const schema: Record<string, any> = {};
    const { data: enumData, error: enumError } = await supabase.rpc(
      "get_all_enum_values",
    );
    if (enumError) {
      console.error("Failed to fetch ENUM values:", enumError.message);
    }
    const enumMap =
      enumData?.reduce(
        (
          acc: Record<string, string[]>,
          row: { enum_type: string; enum_value: string },
        ) => {
          if (!acc[row.enum_type]) acc[row.enum_type] = [];
          acc[row.enum_type].push(row.enum_value);
          return acc;
        },
        {},
      ) || {};
    data?.forEach((col: any) => {
      const columnName = col.name ?? col.column_name;
      const udtName = col.dataType ?? col.udt_name;
      const isNullable = col.nullable ?? col.is_nullable;
      const isAutoIncrement = col.is_autoincrement ?? col.is_autoincrement;
      const isArray = udtName.startsWith("_");
      const baseType = isArray ? udtName.substring(1) : udtName;
      const isEnum = !!enumMap[baseType];
      schema[columnName] = {
        type: baseType,
        nullable: isNullable,
        isAutoIncrement: isAutoIncrement,
        isArray,
        isEnum,
        enumValues: isEnum ? enumMap[baseType] : [],
      };
    });
    // console.log("schema ", schema);
    return { columns: schema };
  } catch (error) {
    console.error(
      `Unexpected error fetching schema for table ${table}:`,
      error,
    );
    return {};
  }
};

export const upsertTableEntry = async (
  table: TableName,
  data: Record<string, any>,
) => {
  try {
    const { error } = await supabase.from(table).upsert(data);

    if (error) {
      console.error(`Failed to upsert data in table ${table}:`, error.message);
      throw new Error(error.message);
    }

    console.log(`Successfully upserted data into table "${table}"`);
    return true;
  } catch (error) {
    console.error(`Unexpected error during upsert in table ${table}:`, error);
    throw new Error("An unexpected error occurred during upsert.");
  }
};

export const getRowById = async (table: TableName, id: number) => {
  try {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error(
        `Error fetching row with ID ${id} from table ${table}:`,
        error.message,
      );
      return null;
    }

    return data;
  } catch (err) {
    console.error(`Unexpected error fetching row from ${table}`, err);
    return null;
  }
};

export async function getDocumentationLink() {
  const { data, error } = await supabase
    .from("dynamic_links")
    .select()
    .eq("name", "documentation");

  if (error) {
    console.error("Failed to fetch link:", error.message);
    return "";
  }

  return data[0].link;
}

const MEMBERSHIP_LINK_FALLBACK =
  "https://omnilore-ecart.squarespace.com/membership";

export async function getMembershipLink() {
  const { data, error } = await supabase
    .from("dynamic_links")
    .select("link")
    .eq("name", "membership")
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch membership link:", error.message);
    return MEMBERSHIP_LINK_FALLBACK;
  }

  return data?.link ?? MEMBERSHIP_LINK_FALLBACK;
}
