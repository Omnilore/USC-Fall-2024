"use client";

import { useState, useEffect, useMemo } from "react";
import { getRoles, getPermissions, Permission } from "@/app/supabase";
import { ActionButton } from "@/components/ui/ActionButton";
import TableComponent from "@/components/ui/TableComponent";
import SelectDropdown from "@/components/ui/SelectDropdown";
import SearchInput from "@/components/ui/SearchInput";
import { queryTableWithPrimaryKey, TableName } from "@/app/queryFunctions";
import ActionPanel from "@/components/ui/ActionPanel";
import DeletePanel from "@/components/ui/DeletePanel";
import { MoonLoader } from "react-spinners";
import { useLocalStorage } from "@uidotdev/usehooks";
import { ClientOnly } from "@/components/is-client";
import { supabase } from "@/app/supabase";
import { formatDate } from "@/lib/utils";

export default function () {
  return (
    <ClientOnly>
      <Table />
    </ClientOnly>
  );
}

function Table() {
  const [query, setQuery] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [entries, setEntries] = useState<Record<string, any>[]>([]);
  const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(
    null,
  );
  const [editMode, setEditMode] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, Permission[]>>(
    {},
  );
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useLocalStorage<TableName>(
    "selected_table",
    "members",
  );

  const [selectedSort, setSelectedSort] = useLocalStorage<string>(
    `selected_sort_${String(selectedTable)}`,
    "default",
  );
  const [selectedSortWay, setSelectedSortWay] = useLocalStorage<"asc" | "desc">(
    `selected_sort_way_${String(selectedTable)}`,
    "asc",
  );

  const [sortOptions, setSortOptions] = useState<string[]>(["default"]);
  const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);
  const [isEntryPanelOpen, setIsEntryPanelOpen] = useState(false);
  const [isDeletePanelOpen, setIsDeletePanelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Transaction modal state
  const [showTransactions, setShowTransactions] = useState(false);
  const [memberTransactions, setMemberTransactions] = useState<any[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Set client flag after mount to avoid hydration issues
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Toggle for audit_logs to include/exclude cron/service logs
  const [includeServiceLogs, setIncludeServiceLogs] = useLocalStorage<boolean>(
    "audit_logs_include_service",
    true,
  );



    const filteredEntries = useMemo(() => {
      let base = entries;
      if (selectedTable === "audit_logs" && !includeServiceLogs) {
            base = base.filter((row) => row?.source !== "service");
      }
    const keywords = query.toLowerCase().split(" ").filter(Boolean);
    return base.filter((item) =>
      keywords.every((kw) =>
        Object.values(item).some(
          (value) =>
            value !== null && value.toString().toLowerCase().includes(kw),
        ),
      ),
    );
  }, [query, entries, selectedTable, includeServiceLogs]);

  const sortedEntries = useMemo(() => {
    if (selectedSort === "default") return filteredEntries;
    return filteredEntries.toSorted((a, b) => {
      if (
        selectedSort === "date" ||
        selectedSort === "updated_at" ||
        selectedSort === "created_at"
      ) {
        const dateA = new Date(a[selectedSort]);
        const dateB = new Date(b[selectedSort]);
        return selectedSortWay === "asc"
          ? dateA.getTime() - dateB.getTime()
          : dateB.getTime() - dateA.getTime();
      }

      if (selectedSort === "first_name" && a["last_name"] && b["last_name"]) {
        const aName = a[selectedSort] + " " + a["last_name"];
        const bName = b[selectedSort] + " " + b["last_name"];
        return selectedSortWay === "asc"
          ? aName.localeCompare(bName)
          : bName.localeCompare(aName);
      }

      if (selectedSort === "last_name" && a["first_name"] && b["first_name"]) {
        const aName = a[selectedSort] + " " + a["first_name"];
        const bName = b[selectedSort] + " " + b["first_name"];
        return selectedSortWay === "asc"
          ? aName.localeCompare(bName)
          : bName.localeCompare(aName);
      }

      if (selectedSort === "year") {
        if (a["year"] === null) return 1;
        if (b["year"] === null) return -1;
        const aYear = a[selectedSort] + " " + a["group_id"];
        const bYear = b[selectedSort] + " " + b["group_id"];
        return selectedSortWay === "asc"
          ? aYear.localeCompare(bYear)
          : bYear.localeCompare(aYear);
      }

      if (
        typeof a[selectedSort] === "number" ||
        typeof b[selectedSort] === "number"
      ) {
        return selectedSortWay === "asc"
          ? (a[selectedSort] ?? 0) - (b[selectedSort] ?? 0)
          : (b[selectedSort] ?? 0) - (a[selectedSort] ?? 0);
      }

      if (
        typeof a[selectedSort] === "string" ||
        typeof b[selectedSort] === "string"
      ) {
        return selectedSortWay === "asc"
          ? (a[selectedSort] ?? "").localeCompare(b[selectedSort] ?? "")
          : (b[selectedSort] ?? "").localeCompare(a[selectedSort] ?? "");
      }

      return selectedSortWay === "asc"
        ? (a[selectedSort] ?? "").localeCompare(b[selectedSort] ?? "")
        : (b[selectedSort] ?? "").localeCompare(a[selectedSort] ?? "");
    });
  }, [filteredEntries, selectedSort, selectedSortWay]);

// Fetch member transactions
const fetchMemberTransactions = async (memberId: number) => {
  try {
    const { data: memberTransactions, error: mttError } = await supabase
      .from("members_to_transactions")
      .select(`
        transaction_id,
        amount,
        sku
      `)
      .eq("member_id", memberId);

    if (mttError) {
      console.error("Failed to fetch member transactions", mttError);
      return [];
    }

    if (!memberTransactions || memberTransactions.length === 0) {
      return [];
    }

    const transactionIds = memberTransactions.map(mt => mt.transaction_id);

    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select(`
        id,
        date,
        payment_platform,
        fulfillment_status,
        refunded_amount,
        amount,
        created_at,
        sqsp_id
      `)
      .in("id", transactionIds)
      .order("date", { ascending: false });

    if (txError) {
      console.error("Failed to fetch transactions", txError);
      return [];
    }

    const skus = [...new Set(memberTransactions.map((mt) => mt.sku))];

    const { data: products = [], error: productError } = await supabase
      .from("products")
      .select("sku, descriptor, type")
      .in("sku", skus);

    if (productError) {
      console.error("Failed to fetch products", productError);
    }

    const productMap = Object.fromEntries(
      (products ?? []).map((p) => [p.sku, p])
    );

    const mttMap = Object.fromEntries(
      memberTransactions.map(mt => [mt.transaction_id, mt])
    );

    const processedTransactions = transactions.map(transaction => {
      const mt = mttMap[transaction.id];
      if (!mt) return null;

      const product = productMap[mt.sku];
      
      let display_status = "Completed";

      if (transaction.refunded_amount > 0) {
        if (transaction.refunded_amount === transaction.amount) {
          display_status = "Fully Refunded";
        } else {
          display_status = "Partially Refunded";
        }
      } else if (transaction.fulfillment_status === "CANCELED") {
        display_status = "Canceled";
      } else if (transaction.fulfillment_status === "PENDING") {
        display_status = "Pending";
      } else if (transaction.fulfillment_status === "FULFILLED") {
        display_status = "Completed";
      } else {
        display_status = transaction.fulfillment_status || "Unknown";
      }

      return {
        transaction_id: transaction.id,
        amount: mt.amount,
        sku: mt.sku,
        date: transaction.date,
        payment_platform: transaction.payment_platform,
        fulfillment_status: transaction.fulfillment_status,
        refunded_amount: transaction.refunded_amount,
        total_amount: transaction.amount,
        created_at: transaction.created_at,
        sqsp_id: transaction.sqsp_id,
        product_descriptor: product?.descriptor || "Unknown",
        product_type: product?.type || "Unknown",
        display_status,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

    // Sort: refunds/recharacterized at top, then newest first
    const sortedTransactions = processedTransactions.sort((a, b) => {
      const aIsRefund =
        (a.product_type as string) === "REFUND" ||
        (a.refunded_amount ?? 0) > 0;
      const bIsRefund =
        (b.product_type as string) === "REFUND" ||
        (b.refunded_amount ?? 0) > 0;

      if (aIsRefund !== bIsRefund) {
        return aIsRefund ? -1 : 1;
      }

      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return sortedTransactions;
  } catch (error) {
    console.error("Error fetching transactions", error);
    return [];
  }
};


  const handleRecharacterize = async (
    transactionId: number,
    newType: "MEMBERSHIP" | "FORUM" | "DONATION" | "REFUND"
  ) => {
    try {
      const t = memberTransactions.find(
        (t) => t.transaction_id === transactionId
      );
  
      if (!t) {
        console.error("No transaction found for recharacterization");
        return;
      }
  
      const { sku, amount } = t;
  
      // 1. Update PRODUCT TYPE
      const { error: productError } = await supabase
        .from("products")
        .update({
          type: newType as any
            | "MEMBERSHIP"
            | "FORUM"
            | "DONATION"
            | "REFUND"
            | "UNKNOWN"
            | "HIDDEN",
        })
        .eq("sku", sku);
  
      if (productError) {
        console.error("Failed to update product type", productError);
        return;
      }
  
      if (newType === "REFUND") {
        const { error: transError } = await supabase
          .from("transactions")
          .update({
            refunded_amount: amount,      // full amount refunded
            fulfillment_status: "CANCELED",   // valid enum value
          })
          .eq("id", transactionId);
      
        if (transError) {
          console.error("Failed to update transaction refund fields", transError);
          return;
        }
      }
      
  
// 3. Update UI immediately
setMemberTransactions(prev =>
  prev.map(tr => {
    if (tr.transaction_id !== transactionId) return tr;

    // Copy the original fields
    let updatedRefundedAmount = tr.refunded_amount;
    let updatedFulfillmentStatus = tr.fulfillment_status;
    let updatedDisplayStatus = tr.display_status;

    // Case 1: REFUND (recharacterized as refund)
    if (newType === "REFUND") {
      updatedRefundedAmount = amount;         // Set refunded amount
      updatedFulfillmentStatus = "CANCELED";  // Valid enum value
      updatedDisplayStatus = "Fully Refunded";
    } 
    // Case 2: NOT refund → reset refund info
    else {
      updatedRefundedAmount = 0;              // Reset refunded amount
      updatedFulfillmentStatus = "FULFILLED"; // Or the original status if you want
      updatedDisplayStatus = "Completed";     // Reset display label
    }

    return {
      ...tr,
      product_type: newType,
      refunded_amount: updatedRefundedAmount,
      fulfillment_status: updatedFulfillmentStatus,
      display_status: updatedDisplayStatus,
    };
  })
);

      
  
    } catch (err) {
      console.error("Unexpected error updating transaction type:", err);
    }
  };
  

  const handleViewTransactions = async () => {
    if (!selectedRow || selectedTable !== "members") {
      alert("Please select a member from the members table");
      return;
    }
    
    const transactions = await fetchMemberTransactions(selectedRow.id);
    setMemberTransactions(transactions);
    setShowTransactions(true);
  };

  useEffect(() => {
    const setup = async () => {
      try {
        setIsLoading(true);
        const userRoles = await getRoles();
        if (!userRoles) {
          console.error("Failed to fetch roles");
          return;
        }
        setRoles(userRoles);

        const allPermissions: Record<string, Permission[]> = {};
        const viewTables = new Set<string>();

        for (const role of userRoles) {
          const rolePermissions = await getPermissions(role);
          allPermissions[role] = rolePermissions;

          rolePermissions.forEach((permission) => {
            if (permission.can_read) {
              viewTables.add(permission.table_name);
            }
          });
        }

        const tablesArray = Array.from(viewTables);
        setPermissions(allPermissions);
        setTables(tablesArray);

        if (tablesArray.length > 0 && !tablesArray.includes(String(selectedTable))) {
          setSelectedTable(tablesArray[0] as TableName);
        }
      } catch (error) {
        console.error("Error during setup", error);
      } finally {
        setIsLoading(false);
      }
    };

    setup().catch(console.error);
  }, []);

  const fetchEntries = async () => {
    if (!selectedTable) return;
    try {
      const { data, primaryKeys } =
        await queryTableWithPrimaryKey(selectedTable,
          selectedTable === "audit_logs" ? { includeServiceLogs, limit: 1000 }: undefined,
        );
      setEntries(data);
      
      setPrimaryKeys(primaryKeys ?? []);

      // Guard against empty data
      const keys = data && data.length > 0 ? new Set(Object.keys(data[0])) : new Set<string>();
      const sortOptions = ["default"];

      for (const key of [
        "first_name",
        "last_name",
        "sqsp_id",
        "descriptor",
        "sku",
        "date",
        "amount",
        "year",
        "role_name",
        "table_name",
        "first_member_id",
        "member_id",
        "committee_name",
        "id",
        "updated_at",
        "created_at",
      ]) {
        if (keys.has(key)) {
          sortOptions.push(key);
        }
      }

      setSortOptions(sortOptions);
    } catch (error) {
      console.error(
        `Failed to fetch data for table ${String(selectedTable)}`,
        error
      );
      console.error("Error details:", JSON.stringify(error, null, 2));
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [selectedTable,includeServiceLogs]);

  const hasPermission = (action: keyof Permission) => {
    if (!selectedTable) return false;

    return roles.some((role) =>
      permissions[role]?.some(
        (p) => p.table_name === selectedTable && p[action],
      ),
    );
  };

  const openDeletePanel = () => {
    if (selectedRow == null) {
      alert("Select a row");
      return;
    }

    setIsDeletePanelOpen(true);
  };

  const openEntryPanel = (mode: "add" | "edit") => {
    if (mode === "edit" && selectedRow === null) {
      alert("Select a row");
      return;
    }

    if (
      (mode === "add" && hasPermission("can_create")) ||
      (mode === "edit" && hasPermission("can_write"))
    ) {
      setEditMode(mode === "edit");
      setIsEntryPanelOpen(true);
    } else {
      alert(`NO ${mode.toUpperCase()} PERMISSION`);
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-gray-100">
      {/* Transactions Modal */}
      {showTransactions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-3/4 max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                Transactions for {selectedRow?.first_name} {selectedRow?.last_name}
              </h2>
              <button
                onClick={() => setShowTransactions(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {memberTransactions.length === 0 ? (
                <p className="text-gray-500">No transactions found.</p>
              ) : (
                memberTransactions.map((transaction, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <strong>Date:</strong> {isClient ? formatDate(transaction.date, true) : transaction.date}
                      </div>
                      <div>
                        <strong>Type:</strong> {transaction.product_type}
                        {
                        <select
                          value={transaction.product_type}
                          onChange={(e) =>
                            handleRecharacterize(
                              transaction.transaction_id,
                              e.target.value as "MEMBERSHIP" | "FORUM" | "DONATION" | "REFUND"
                            )
                          }
                          className="border rounded px-2 py-1 text-sm"
                        >
                          <option value="MEMBERSHIP">Membership</option>
                          <option value="FORUM">Forum</option>
                          <option value="DONATION">Donation</option>
                          <option value="REFUND">Refund</option>
                        </select>
                        }
                      </div>
                      <div>
                        <strong>Amount:</strong> ${transaction.amount}
                      </div>
                      <div>
                        <strong>Purpose:</strong> {transaction.product_descriptor}
                      </div>
                      <div>
                        <strong>Platform:</strong> {transaction.payment_platform}
                      </div>
                      <div>
                        <strong>Status:</strong> {transaction.display_status}
                      </div>
                      <div>
                        <strong>Squarespace ID:</strong> {transaction.payment_platform === "MAIL" 
                          ? "Mail" 
                          : transaction.sqsp_id?.toString() ?? "N/A"}
                      </div>
                      {transaction.refunded_amount > 0 && (
                        <div className="col-span-2">
                          <strong>Refunded:</strong> ${transaction.refunded_amount}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowTransactions(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex w-full grow flex-col items-center justify-center overflow-y-auto">
        {roles === null ? (
          <div>Don't have the necessary permission</div>
        ) : isLoading ? (
          <div className="flex h-full items-center justify-center">
            <MoonLoader />
          </div>
        ) : (
          <div className="flex h-[95%] w-[98%] flex-row items-center gap-4">
            <div className="flex h-full w-full flex-col items-center">
              <div className="flex h-full w-full flex-col gap-3">
                {/* Select and add, delete, and edit buttons */}
                <div className="flex justify-between">
                  <div className="w-1/5">
                    <SelectDropdown
                      options={tables}
                      selectedOption={String(selectedTable)}
                      setSelectedOption={(table) => {
                        setSelectedTable(table as TableName);
                      }}
                    />
                  </div>
                  <div className="flex w-2/5 gap-4">
                    <div className="flex w-full items-center gap-2">
                      <p className="min-w-fit">Sort by:</p>
                      <SelectDropdown
                        options={sortOptions}
                        selectedOption={selectedSort}
                        setSelectedOption={(sort) => {
                          setSelectedSort(sort as string);
                        }}
                      />
                    </div>
                    <div className="flex w-full items-center gap-2">
                      <p className="min-w-fit">Sort way:</p>
                      <SelectDropdown
                        options={["asc", "desc"]}
                        selectedOption={selectedSortWay}
                        setSelectedOption={(sort) => {
                          setSelectedSortWay(sort as "asc" | "desc");
                        }}
                      />
                    </div>
                  </div>
                  {/* <div className="flex gap-1">
                    {hasPermission("can_create") && (
                      <ActionButton
                        actionType="add"
                        onClick={() => openEntryPanel("add")}
                      />
                    )}
                    {hasPermission("can_write") && (
                      <ActionButton
                        actionType="edit"
                        onClick={() => openEntryPanel("edit")}
                      />
                    )}
                    {hasPermission("can_delete") && (
                      <ActionButton
                        actionType="delete"
                        onClick={() => openDeletePanel()}
                      />
                    )}
                  </div> */}
                  <div className="flex items-center gap-4">
                    {selectedTable === "audit_logs" && (
                      <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={includeServiceLogs}
                          onChange={(e) => setIncludeServiceLogs(e.target.checked)}
                          className="h-4 w-4"
                        />
                        Include cron/service logs
                      </label>
                    )}

                    <div className="flex gap-1">
                      {hasPermission("can_create") && (
                        <ActionButton
                          actionType="add"
                          onClick={() => openEntryPanel("add")}
                        />
                      )}
                      {hasPermission("can_write") && (
                        <ActionButton
                          actionType="edit"
                          onClick={() => openEntryPanel("edit")}
                        />
                      )}
                      {hasPermission("can_delete") && (
                        <ActionButton
                          actionType="delete"
                          onClick={() => openDeletePanel()}
                        />
                      )}
                    </div>

                    {/* View Transactions button - only show for members table */}
                    {selectedTable === "members" && (
                      <button
                        onClick={handleViewTransactions}
                        className="flex cursor-pointer items-center gap-1 rounded-3xl px-4 text-sm font-medium transition-colors bg-blue-100 hover:bg-blue-200"
                      >
                        <span className="font-semibold">view transactions</span>
                      </button>
                    )}
                  </div>

                </div>

                {/* Search Input */}
                <SearchInput query={query} setQuery={setQuery} />

                {/* Table Component */}
                {primaryKeys && (
                  <div className="w-full grow overflow-y-auto">
                    <TableComponent
                      entries={sortedEntries}
                      roles={roles}
                      selectedRow={selectedRow}
                      handleRowSelection={(row) => setSelectedRow(row)}
                      handleRowDeselection={() => setSelectedRow(null)}
                      primaryKeys={primaryKeys}
                      adminTable={true}
                      showImages={false}
                    />
                  </div>
                )}
              </div>

              {/* Add and Edit Panel */}
              {selectedTable && (
                <ActionPanel
                  isOpen={isEntryPanelOpen}
                  onClose={() => setIsEntryPanelOpen(false)}
                  selectedTable={selectedTable}
                  mode={editMode ? "edit" : "add"}
                  selectedRow={selectedRow || undefined}
                  primaryKeys={primaryKeys}
                  reloadData={fetchEntries}
                />
              )}
              {/* Delete Panel */}
              {selectedTable && (
                <DeletePanel
                  isOpen={isDeletePanelOpen}
                  onClose={() => setIsDeletePanelOpen(false)}
                  selectedTable={selectedTable}
                  selectedRow={selectedRow}
                  primaryKeys={primaryKeys}
                  reloadData={fetchEntries}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
