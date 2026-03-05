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
    `selected_sort_${selectedTable}`,
    "default",
  );
  const [selectedSortWay, setSelectedSortWay] = useLocalStorage<"asc" | "desc">(
    `selected_sort_way_${selectedTable}`,
    "asc",
  );
  const [sortOptions, setSortOptions] = useState<string[]>(["default"]);
  const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);
  const [isEntryPanelOpen, setIsEntryPanelOpen] = useState(false);
  const [isDeletePanelOpen, setIsDeletePanelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

        // Set the first table and trigger data fetching
        if (tablesArray.length > 0 && !tablesArray.includes(selectedTable)) {
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
      setPrimaryKeys(primaryKeys ?? "");

      const keys = new Set(Object.keys(data[0]));
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
      console.error(`Failed to fetch data for table ${selectedTable}`, error);
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
                      selectedOption={selectedTable}
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
