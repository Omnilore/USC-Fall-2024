"use client";
import { useState, useEffect, useRef, Fragment } from "react";
import UserIcon from "@/components/assets/user-icon.png";
import { MoonLoader } from "react-spinners";
import { Copy } from "lucide-react";

interface TableComponentProps {
  entries: Record<string, any>[];
  roles: string[];
  selectedRow: Record<string, any> | null;
  handleRowSelection: (row: Record<string, any>) => void;
  handleRowDeselection?: () => void;
  primaryKeys: string[];
  adminTable?: boolean;
  showImages?: boolean;
  selectable?: boolean;
}

// Function to format phone number as (xxx)xxx-xxxx
const formatPhoneNumber = (phoneNumberString: string) => {
  // Remove all non-digit characters
  const cleaned = String(phoneNumberString).replace(/\D/g, "");

  // Check if the input is of correct length
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);

  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }

  // Return the original value if it doesn't match the expected format
  return phoneNumberString;
};

// Function to copy text to clipboard
const copyToClipboard = (text: string, e?: React.MouseEvent) => {
  if (e) {
    e.stopPropagation(); // Prevent row selection when clicking copy button
  }
  navigator.clipboard.writeText(text);
};

const TableComponent = ({
  entries,
  roles,
  selectedRow,
  handleRowSelection,
  handleRowDeselection,
  primaryKeys,
  adminTable = true,
  showImages = false,
  selectable = true,
}: TableComponentProps) => {
  const [localSelectedRow, setLocalSelectedRow] = useState<Record<
    string,
    any
  > | null>(selectedRow);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const headerRefs = useRef<(HTMLTableCellElement | null)[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 200); // Simulate data loading time
    return () => clearTimeout(timer);
  }, [entries]);

  useEffect(() => {
    if (!loading && headerRefs.current.length > 0) {
      const newWidths = headerRefs.current.map((th) => th?.offsetWidth || 50);
      setColumnWidths(newWidths);
    }
  }, [loading, entries, primaryKeys]);

  const handleRowClick = (row: Record<string, any>) => {
    if (localSelectedRow !== row) {
      setLocalSelectedRow(row);
      handleRowSelection(row);
    }
    if (localSelectedRow === row) {
      setLocalSelectedRow(null);
      if (handleRowDeselection) {
        handleRowDeselection();
      }
    }
  };

  useEffect(() => {
    console.log("UPDATED ROW OBJECT: ", localSelectedRow);
  }, [localSelectedRow]);

  const validRoles = ["dba", "membership", "treasurer", "bioadmin", "member"];
  const hasValidRole = roles.some((role) => validRoles.includes(role));

  if (!hasValidRole) {
    return (
      <div className="py-4 text-center text-gray-500">
        You do not have the necessary permissions to view this data.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-gray-500">
          <MoonLoader />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="overflow-x:visible custom-scrollbar h-full w-full grow overflow-x-auto overflow-y-auto">
        <div className="h-full min-h-full w-full min-w-full">
          <table className="w-full border-collapse border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                {(() => {
                  const headerCells = [];

                  if (adminTable) {
                    headerCells.push(
                      <th
                        key="header-select"
                        ref={(el) => {
                          headerRefs.current[0] = el;
                        }}
                        className="sticky top-0 z-20 bg-gray-100 px-4 py-2 outline-hidden"
                        style={{
                          left: '0px',
                          boxShadow: "inset 0 0 0 0.5px #e5e7eb",
                        }}
                      >
                        Select
                      </th>
                    );

                    primaryKeys.forEach((key, colIndex) => {
                      const leftOffset = columnWidths.slice(0, colIndex + 1).reduce((sum, w) => sum + (w || 50), 0);
                      headerCells.push(
                        <th
                          key={key}
                          ref={(el) => {
                            headerRefs.current[colIndex + 1] = el;
                          }}
                          className="sticky top-0 z-20 bg-gray-100 px-4 py-2 outline-hidden"
                          style={{
                            left: `${leftOffset}px`,
                            boxShadow: "inset 0 0 0 0.5px #e5e7eb",
                          }}
                        >
                          {key}
                        </th>
                      );
                    });
                  }

                  if (entries.length > 0) {
                    Object.keys(entries[0])
                      .filter((name) => !primaryKeys.includes(name))
                      .forEach((columnName) => {
                        headerCells.push(
                          <th
                            key={columnName}
                            className="sticky top-0 z-10 bg-gray-100 px-4 py-2 outline-hidden"
                            style={{ boxShadow: "inset 0 0 0 0.5px #e5e7eb" }}
                          >
                            {columnName}
                          </th>
                        );
                      });
                  }

                  return headerCells;
                })()}
              </tr>
            </thead>
            <tbody>
              {entries.map((item, index) => {
                const hasIssue = Object.keys(item).some(
                  (columnName) =>
                    columnName === "issues" &&
                    Array.isArray(item[columnName]) &&
                    item[columnName].length > 0,
                );

                const isSelected =
                  selectable &&
                  localSelectedRow &&
                  primaryKeys.every(
                    (key) => localSelectedRow[key] === item[key],
                  );

                // Create a unique key using primary keys or fallback to index
                const uniqueKey = primaryKeys.length > 0
                  ? primaryKeys.map(key => item[key] ?? 'null').join('-') + `-${index}`
                  : `row-${index}`;

                return (
                  <tr
                    key={uniqueKey}
                    className={`group cursor-pointer ${hasIssue
                      ? "bg-red-50"
                      : isSelected
                        ? "bg-gray-100"
                        : "bg-white group-hover:bg-gray-50"
                      }`}
                    onClick={() => handleRowClick(item)}
                  >
                    {(() => {
                      const bodyCells = [];

                      if (adminTable) {
                        bodyCells.push(
                          <td
                            key={`${uniqueKey}-select`}
                            className={`sticky z-10 w-10 px-4 py-2 text-center ${hasIssue
                                ? "bg-red-50"
                                : isSelected
                                  ? "bg-gray-100"
                                  : "bg-white group-hover:bg-gray-50"
                              }`}
                            style={{
                              left: '0px',
                              boxShadow: "inset 0 0 0 0.5px #e5e7eb",
                              outline: "none",
                            }}
                          >
                            <span
                              className="absolute top-0 -left-[1px] h-full w-[1px] bg-gray-200"
                              aria-hidden="true"
                            />
                            <input
                              type="radio"
                              name="row-selection"
                              checked={!!isSelected}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => handleRowClick(item)}
                            />
                          </td>
                        );

                        primaryKeys.forEach((key, colIndex) => {
                          const leftOffset = columnWidths.slice(0, colIndex + 1).reduce((sum, w) => sum + (w || 50), 0);
                          bodyCells.push(
                            <td
                              key={`${uniqueKey}-${key}`}
                              className={`sticky z-10 px-4 py-2 ${hasIssue
                                  ? "bg-red-50"
                                  : isSelected
                                    ? "bg-gray-100"
                                    : "bg-white group-hover:bg-gray-50"
                                }`}
                              style={{
                                left: `${leftOffset}px`,
                                boxShadow: "inset 0 0 0 0.5px #e5e7eb",
                              }}
                            >
                              {item[key] ?? ""}
                            </td>
                          );
                        });
                      }

                      Object.keys(item)
                        .filter((name) => !primaryKeys.includes(name))
                        .forEach((columnName) => {
                          if (showImages && (columnName === "Photo" || columnName === "photo_link")) {
                            bodyCells.push(
                              <td
                                key={columnName}
                                className={`px-4 py-2 ${hasIssue
                                    ? "bg-red-50"
                                    : isSelected
                                      ? "bg-gray-100"
                                      : "bg-white group-hover:bg-gray-50"
                                  }`}
                                style={{
                                  boxShadow: "inset 0 0 0 0.5px #e5e7eb",
                                  outline: "none",
                                }}
                              >
                                <div className="h-12 w-12 overflow-hidden rounded-full border border-gray-300">
                                  <img
                                    src={item[columnName] || UserIcon.src}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              </td>
                            );
                          } else {
                            // Check if this is an email or phone column that should have copy functionality
                            const isEmailColumn = columnName.toLowerCase() === "email";
                            const isPhoneColumn = columnName.toLowerCase().includes("phone");
                            const hasCopyableValue = (isEmailColumn || isPhoneColumn) && item[columnName];
                            
                            bodyCells.push(
                              <td
                                key={columnName}
                                className={`px-4 py-2 ${hasIssue
                                    ? "bg-red-50"
                                    : isSelected
                                      ? "bg-gray-100"
                                      : "bg-white group-hover:bg-gray-50"
                                  } relative ${typeof item[columnName] === "object"
                                    ? "max-w-60 overflow-auto"
                                    : ""
                                  }`}
                                style={{
                                  boxShadow: "inset 0 0 0 0.5px #e5e7eb",
                                  outline: "none",
                                }}
                              >
                                <div
                                  className={`flex items-center gap-2 ${typeof item[columnName] === "object"
                                      ? "max-h-20"
                                      : ""
                                    }`}
                                >
                                  {typeof item[columnName] === "object" &&
                                    item[columnName] !== null
                                    ? JSON.stringify(item[columnName], undefined, 1)
                                    : typeof item[columnName] === "boolean"
                                      ? item[columnName].toString()
                                      : columnName.toLowerCase().includes("phone") &&
                                        item[columnName]
                                        ? formatPhoneNumber(item[columnName])
                                        : item[columnName]}
                                  {hasCopyableValue && (
                                    <button
                                      onClick={(e) => copyToClipboard(item[columnName], e)}
                                      className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                                      title={`Copy ${isEmailColumn ? 'email' : 'phone number'}`}
                                      aria-label={`Copy ${isEmailColumn ? 'email' : 'phone number'}`}
                                    >
                                      <Copy className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            );
                          }
                        });

                      return bodyCells;
                    })()}
                  </tr>
                );
              })}
              {entries.length === 0 && (
                <tr>
                  <td
                    colSpan={
                      entries.length > 0 ? Object.keys(entries[0]).length : 1
                    }
                    className="py-4 text-center text-gray-500"
                  >
                    No results found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TableComponent;
