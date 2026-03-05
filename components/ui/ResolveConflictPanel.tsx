"use client";

import MergeInputField from "@/components/ui/MergeInputField";
import type { SupabaseMember } from "@/app/api/cron/src/supabase/types";
import { useEffect, useRef, useState } from "react";
import { getRowById, getTableSchema } from "@/app/supabase";
import {
  resolve_member_conflict_merge,
  resolve_member_conflict_different_members,
} from "@/app/api/cron/src/supabase/resolve-conflicts";
import { toast } from "sonner";

interface ResolveConflictPanelProps {
  isOpen: boolean;
  onClose: () => void;
  firstMemberId: number;
  secondMemberId: number;
  refresh: () => void;
  isResolved?: boolean;
}

export default function ResolveConflictPanel({
  isOpen,
  onClose,
  firstMemberId,
  secondMemberId,
  refresh,
  isResolved = false,
}: ResolveConflictPanelProps) {
  const [fields, setFields] = useState<any[]>([]);
  const [member1, setMember1] = useState<SupabaseMember | null>(null);
  const [member2, setMember2] = useState<SupabaseMember | null>(null);
  const [resolvedValues, setResolvedValues] = useState<
    Record<string, string | number | boolean | null>
  >({});
  const [customFields, setCustomFields] = useState<Record<string, boolean>>({});
  const [resolvedFields, setResolvedFields] = useState<Record<string, boolean>>(
    {},
  );
  const [openFields, setOpenFields] = useState<Record<string, boolean>>({});
  const [mergeView, setMergeView] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchSchema = async () => {
      const schema = await getTableSchema("members");
      if (schema?.columns) {
        const fieldList = Object.entries(schema.columns).map(
          ([name, details]: any) => ({
            name,
            type: details.type,
            nullable: details.nullable,
            isAutoIncrement: details.isAutoIncrement,
            isArray: details.isArray,
            isEnum: details.isEnum,
            enumValues: details.enumValues || [],
          }),
        );
        setFields(fieldList);
      }
    };
    fetchSchema();
  }, [mergeView]);

  useEffect(() => {
    if (splitView && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [splitView]);

  useEffect(() => {
    const fetchMembers = async () => {
      const data1 = await getRowById("members", firstMemberId);
      const data2 = await getRowById("members", secondMemberId);
      setMember1(data1 as SupabaseMember);
      setMember2(data2 as SupabaseMember);

      const defaultResolved: Record<string, string> = {};
      const defaultResolvedFields: Record<string, boolean> = {};
      const defaultOpenFields: Record<string, boolean> = {};

      if (!data1 || !data2) return;

      Object.entries(data1).forEach(([key, val1]) => {
        const val2 = data2[key as keyof typeof data2];
        const sameValue = val1 === val2;
        const bothEmptyString = val1 === "" && val2 === "";
        const bothNull = val1 === null && val2 === null;
        const bothUndefined = val1 === undefined && val2 === undefined;
        const isResolved =
          sameValue || bothEmptyString || bothNull || bothUndefined;

        defaultResolved[key] = isResolved ? String(val1 ?? "") : "";
        defaultResolvedFields[key] = isResolved;
        defaultOpenFields[key] = !isResolved;
      });

      setResolvedValues(defaultResolved);
      setResolvedFields(defaultResolvedFields);
      setOpenFields(defaultOpenFields);
    };

    if (isOpen) {
      fetchMembers();
    } else {
      setMember1(null);
      setMember2(null);
      setResolvedValues({});
      setCustomFields({});
      setResolvedFields({});
      setOpenFields({});
      setMergeView(false);
      setSplitView(false);
    }
  }, [isOpen, firstMemberId, secondMemberId, isResolved]);

  const handleSelection = (
    key: string,
    value: string | number | boolean | null,
  ) => {
    setResolvedValues((prev) => ({ ...prev, [key]: value }));
    setResolvedFields((prev) => ({ ...prev, [key]: true }));
    setOpenFields((prev) => ({ ...prev, [key]: false }));
    setCustomFields((prev) => ({ ...prev, [key]: false }));
  };

  const updateCustomValue = (key: string, value: string) => {
    setResolvedValues((prev) => ({ ...prev, [key]: value }));
    const isValid = typeof value === "string" && value.trim().length > 0;
    setResolvedFields((prev) => ({ ...prev, [key]: isValid }));
  };

  const confirmCustom = (key: string) => {
    if (resolvedValues[key]?.toString().trim()) {
      setOpenFields((prev) => ({ ...prev, [key]: false }));
    }
    setResolvedFields((prev) => ({ ...prev, [key]: true }));
  };

  const toggleFieldOpen = (key: string) => {
    setOpenFields((prev) => {
      if (!resolvedFields[key]) return { ...prev, [key]: true };
      return { ...prev, [key]: !prev[key] };
    });
  };

  if (!isOpen || !member1 || !member2) return null;

  function isValidDate(d: any): d is Date {
    return d instanceof Date && !isNaN(d.getTime());
  }

  // VIEW-ONLY MODE for resolved conflicts
  if (isResolved) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-white/50 transition-opacity"
          onClick={onClose}
        ></div>

        <div className="fixed right-0 bottom-0 z-50 h-[90%] w-1/3 transform rounded-tl-xl border bg-white shadow-lg translate-x-0 transition-transform duration-250">
          <div className="flex h-full flex-col">
            <div className="flex flex-col border-b p-4 bg-green-50">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-2 flex-1">
                  <div className="text-medium inline-block max-w-fit rounded-3xl bg-green-200 px-4 py-1 italic">
                    <span className="font-semibold">✓ Resolved Conflict</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div><strong>Members:</strong> {firstMemberId} and {secondMemberId}</div>
                  </div>
                </div>
                <button
                  className="inline-block text-xl text-[#616161]"
                  onClick={onClose}
                >
                  ✖
                </button>
              </div>
            </div>

            <div
              ref={scrollContainerRef}
              className="custom-scrollbar flex h-full w-full flex-col gap-4 overflow-hidden overflow-y-auto p-8"
            >
              <span className="text-gray-600 italic">
                This conflict has been resolved and is view-only.
              </span>
              {fields
                .filter(
                  (field) =>
                    field.name !== "updated_at" &&
                    field.name !== "created_at" &&
                    field.name !== "id",
                )
                .map((field) => {
                  const key = field.name;
                  const val1 = member1[key as keyof SupabaseMember];
                  const val2 = member2[key as keyof SupabaseMember];
                  const isEqual = String(val1) === String(val2);
                  const bgColor = isEqual ? "bg-[#DAFBC9]" : "bg-gray-100";

                  return (
                    <div key={key} className={`rounded p-3 ${bgColor}`}>
                      <label className="mb-2 block font-semibold capitalize">
                        {key}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded border bg-white p-1">
                          {val1 === null || val1 === "" ? (
                            <span className="text-gray-400">NULL</span>
                          ) : typeof val1 === "boolean" ? (
                            String(val1)
                          ) : (
                            (val1 ?? "—")
                          )}
                        </div>
                        <div className="rounded border bg-white p-1">
                          {val2 === null || val2 === "" ? (
                            <span className="text-gray-400">NULL</span>
                          ) : typeof val2 === "boolean" ? (
                            String(val2)
                          ) : (
                            (val2 ?? "—")
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              <div className="flex gap-2">
                <button
                  className="text-medium inline-block max-h-fit max-w-fit items-center justify-center rounded-lg bg-gray-100 px-3 py-1"
                  onClick={onClose}
                >
                  Close
                </button>
                <button
                  className="text-medium inline-block max-h-fit max-w-fit items-center justify-center rounded-lg bg-yellow-200 px-3 py-1 font-semibold hover:bg-yellow-300"
                  onClick={async () => {
                    if (confirm("Are you sure you want to un-resolve this conflict? It will move back to the unresolved list.")) {
                      const { unresolve_member_conflict } = await import("@/app/api/cron/src/supabase/resolve-conflicts");
                      
                      toast.promise(
                        unresolve_member_conflict(firstMemberId, secondMemberId).then(() => {
                          onClose();
                          refresh();
                        }),
                        {
                          loading: "Un-resolving conflict...",
                          success: "Conflict reopened successfully!",
                          error: (error) => {
                            console.error(error);
                            return `Error un-resolving conflict. ${error.message}`;
                          },
                        },
                      );
                    }
                  }}
                >
                  Un-Resolve
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // NORMAL EDITING MODE (existing logic continues)
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-white/50 transition-opacity"
          onClick={onClose}
        ></div>
      )}

      <div
        className={`fixed right-0 bottom-0 z-50 h-[90%] w-1/3 transform rounded-tl-xl border bg-white shadow-lg ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } transition-transform duration-250`}
      >
        <div className="flex h-full flex-col">
          <div className="flex flex-col border-b p-4">
            <div className="flex justify-between">
              <div className="text-medium inline-block max-w-fit rounded-3xl bg-[#E5E7EB] px-4 py-1 italic">
                {splitView ? (
                  <span className="font-semibold">separating </span>
                ) : mergeView ? (
                  <span className="font-semibold">merging </span>
                ) : (
                  <span className="font-semibold">comparing </span>
                )}
                <span className="font-light">members </span>
                <span className="font-semibold">{firstMemberId} </span>
                <span className="font-light">and </span>
                <span className="font-semibold">{secondMemberId} </span>
              </div>
              <button
                className="inline-block max-w-fit text-xl text-[#616161]"
                onClick={onClose}
              >
                ✖
              </button>
            </div>
          </div>

          <div
            ref={scrollContainerRef}
            className="custom-scrollbar flex h-full w-full flex-col gap-4 overflow-hidden overflow-y-auto p-8"
          >
            {splitView ? (
              <>
                <span className="text-gray-600">
                  Splitting members {firstMemberId} and {secondMemberId}. Update
                  fields as needed.
                </span>
                <div className="flex justify-between">
                  <div className="w-1/2 text-base font-semibold">
                    Member {firstMemberId}
                  </div>
                  <div className="w-1/2 text-base font-semibold">
                    Member {secondMemberId}
                  </div>
                </div>
                <div className="flex w-full flex-col gap-4">
                  {fields
                    .filter(
                      (field) =>
                        field.name !== "updated_at" &&
                        field.name !== "created_at" &&
                        field.name !== "id",
                    )
                    .map((field) => {
                      const key = field.name;
                      const val1 = member1
                        ? member1[key as keyof SupabaseMember]
                        : undefined;
                      const val2 = member2
                        ? member2[key as keyof SupabaseMember]
                        : undefined;
                      const isEqual = String(val1) === String(val2);
                      const bgColor = isEqual ? "bg-[#DAFBC9]" : "bg-[#FAD9D9]";

                      return (
                        <div key={key} className="flex w-full gap-2">
                          <div
                            className={`rounded p-2 ${bgColor} box-border flex w-1/2 flex-col overflow-hidden`}
                          >
                            <div className="truncate text-sm font-medium">
                              {key}
                            </div>
                            <MergeInputField
                              fieldName={key}
                              fieldType={field.type}
                              required={!field.nullable}
                              value={val1 ?? ""}
                              setFormValue={(name: string, value: any) =>
                                setMember1(
                                  (prev) =>
                                    ({
                                      ...prev,
                                      [name]: value,
                                    }) as SupabaseMember,
                                )
                              }
                              onEnter={() => handleSelection(key, String(val1))}
                              enumValues={field.enumValues}
                              isEnum={field.isEnum}
                              isArray={field.isArray}
                              isAutoIncrement={field.isAutoIncrement}
                              displayLabel={false}
                            />
                          </div>
                          <div
                            className={`rounded p-2 ${bgColor} box-border flex w-1/2 flex-col overflow-hidden`}
                          >
                            <div className="truncate text-sm font-medium">
                              {key}
                            </div>
                            <MergeInputField
                              fieldName={key}
                              fieldType={field.type}
                              required={!field.nullable}
                              value={val2 ?? ""}
                              setFormValue={(name: string, value: any) =>
                                setMember2(
                                  (prev) =>
                                    ({
                                      ...prev,
                                      [name]: value,
                                    }) as SupabaseMember,
                                )
                              }
                              onEnter={() => handleSelection(key, String(val2))}
                              enumValues={field.enumValues}
                              isEnum={field.isEnum}
                              isArray={field.isArray}
                              isAutoIncrement={field.isAutoIncrement}
                              displayLabel={false}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
                <div className="mt-4 flex w-full justify-start gap-2">
                  <button
                    className="text-medium inline-block max-h-fit max-w-fit items-center justify-center rounded-lg bg-gray-100 px-3 py-1"
                    onClick={() => onClose()}
                  >
                    Cancel
                  </button>
                  <button
                    className="text-medium inline-block max-h-fit max-w-fit items-center justify-center rounded-lg bg-red-200 px-3 py-1 font-semibold"
                    onClick={() => {
                      const toAwait = resolve_member_conflict_different_members(
                        firstMemberId,
                        member1,
                        secondMemberId,
                        member2,
                      );

                      toast.promise(
                        toAwait.then(() => {
                          onClose();
                          setSplitView(false);
                          refresh();
                        }),
                        {
                          loading: "Separating members...",
                          success: "Members marked as separate!",
                          error: (error) => {
                            console.error(error);
                            return `Error marking members as separate. ${error.message}`;
                          },
                        },
                      );
                    }}
                  >
                    Separate
                  </button>
                </div>
              </>
            ) : mergeView ? (
              <>
                <span className="text-gray-600">
                  Merging members {firstMemberId} and {secondMemberId}. Choose
                  the correct values or enter custom data where necessary.
                </span>
                {fields
                  .filter(
                    (field) =>
                      field.name !== "updated_at" &&
                      field.name !== "created_at" &&
                      field.name !== "id",
                  )
                  .map((field) => {
                    const key = field.name;
                    const val1 = member1[key as keyof SupabaseMember];
                    const val2 = member2[key as keyof SupabaseMember];
                    const resolved = resolvedValues[key];
                    const isResolved = resolvedFields[key];
                    const isOpenField = openFields[key];

                    const bgColor = isResolved
                      ? "bg-[#DAFBC9]"
                      : "bg-[#FAD9D9]";

                    return (
                      <div key={key} className={`rounded p-3 ${bgColor}`}>
                        <details open={isOpenField}>
                          <summary
                            className="mb-2 flex cursor-pointer items-center justify-between gap-2"
                            onClick={(e) => {
                              e.preventDefault();
                              toggleFieldOpen(key);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-semibold capitalize">
                                {key}:
                              </span>
                              {!isOpenField && (
                                <span className="max-w-[200px] truncate text-sm text-gray-600 italic">
                                  {resolved === null ||
                                  resolved === "" ||
                                  typeof resolved === "undefined" ? (
                                    <span className="text-gray-400 not-italic">
                                      NULL
                                    </span>
                                  ) : typeof resolved === "boolean" ? (
                                    String(resolved)
                                  ) : isValidDate(resolved) ? (
                                    resolved.toLocaleDateString()
                                  ) : (
                                    resolved
                                  )}
                                </span>
                              )}
                            </div>
                            <span className="ml-auto text-gray-500">▾</span>
                          </summary>

                          <div className="grid grid-cols-3 gap-2">
                            <button
                              className={`rounded border p-1 ${resolved === val1 ? "bg-blue-100" : "bg-white"}`}
                              onClick={() => handleSelection(key, val1)}
                            >
                              {val1 === null || val1 === "" ? (
                                <span className="text-gray-400">NULL</span>
                              ) : typeof val1 === "boolean" ? (
                                String(val1)
                              ) : (
                                (val1 ?? "—")
                              )}
                            </button>
                            <button
                              className={`rounded border p-1 ${resolved === val2 ? "bg-blue-100" : "bg-white"}`}
                              onClick={() => handleSelection(key, val2)}
                            >
                              {val2 === null || val2 === "" ? (
                                <span className="text-gray-400">NULL</span>
                              ) : typeof val2 === "boolean" ? (
                                String(val2)
                              ) : (
                                (val2 ?? "—")
                              )}
                            </button>
                            <MergeInputField
                              fieldName={key}
                              fieldType={field.type}
                              required={!field.nullable}
                              value={resolvedValues[key] ?? ""}
                              setFormValue={(name, value) =>
                                setResolvedValues((prev) => ({
                                  ...prev,
                                  [name]: value,
                                }))
                              }
                              onEnter={() => confirmCustom(key)}
                              enumValues={field.enumValues}
                              isEnum={field.isEnum}
                              isArray={field.isArray}
                              isAutoIncrement={field.isAutoIncrement}
                              displayLabel={false}
                            />
                          </div>
                        </details>
                      </div>
                    );
                  })}

                <div className="flex w-full justify-start gap-2">
                  <button
                    className="text-medium inline-block max-h-fit max-w-fit items-center justify-center rounded-lg bg-gray-100 px-3 py-1"
                    onClick={() => onClose()}
                  >
                    Cancel
                  </button>
                  <button
                    className="text-medium inline-block max-h-fit max-w-fit items-center justify-center rounded-lg bg-[#E5E7EB] px-3 py-1 font-semibold"
                    onClick={async () => {
                      if (
                        Object.entries(resolvedFields).some(
                          ([k, v]) =>
                            v === false &&
                            k !== "id" &&
                            k !== "created_at" &&
                            k !== "updated_at",
                        )
                      ) {
                        toast.error("Please resolve all conflicts.", {
                          description: `
                          Still missing ${Object.entries(resolvedFields)
                            .filter(
                              ([k, v]) =>
                                v === false &&
                                k !== "id" &&
                                k !== "created_at" &&
                                k !== "updated_at",
                            )
                            .map(([k]) => k)
                            .join(", ")}`,
                        });
                        return;
                      }

                      console.log("Resolved Data:", resolvedValues);
                      const toAwait = resolve_member_conflict_merge(
                        firstMemberId,
                        secondMemberId,
                        resolvedValues,
                      );

                      toast.promise(
                        toAwait.then(() => {
                          onClose();
                          refresh();
                        }),
                        {
                          loading: "Resolving...",
                          success: "Member conflict resolved!",
                          error: (error) => {
                            console.error(error);
                            return `Error resolving member conflict. ${error.message}`;
                          },
                        },
                      );
                    }}
                  >
                    Merge
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="text-gray-600">
                  Reviewing members {firstMemberId} and {secondMemberId} to
                  determine whether they should be merged or kept separate.
                </span>
                {fields
                  .filter(
                    (field) =>
                      field.name !== "updated_at" &&
                      field.name !== "created_at" &&
                      field.name !== "id",
                  )
                  .map((field) => {
                    const key = field.name;
                    const val1 = member1
                      ? member1[key as keyof SupabaseMember]
                      : undefined;
                    const val2 = member2
                      ? member2[key as keyof SupabaseMember]
                      : undefined;
                    const isEqual = String(val1) === String(val2);
                    const bgColor = isEqual ? "bg-[#DAFBC9]" : "bg-[#FAD9D9]";

                    return (
                      <div key={key} className={`rounded p-3 ${bgColor}`}>
                        <label className="mb-2 block font-semibold capitalize">
                          {key}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded border bg-white p-1">
                            {val1 === null || val1 === "" ? (
                              <span className="text-gray-400">NULL</span>
                            ) : typeof val1 === "boolean" ? (
                              String(val1)
                            ) : (
                              (val1 ?? "—")
                            )}
                          </div>
                          <div className="rounded border bg-white p-1">
                            {val2 === null || val2 === "" ? (
                              <span className="text-gray-400">NULL</span>
                            ) : typeof val2 === "boolean" ? (
                              String(val2)
                            ) : (
                              (val2 ?? "—")
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                <div className="flex w-full justify-start gap-2">
                  <button
                    className="text-medium inline-block max-h-fit max-w-fit items-center justify-center rounded-lg bg-gray-100 px-3 py-1"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    className="text-medium inline-block max-h-fit max-w-fit items-center justify-center rounded-lg bg-[#C9FFAE] px-3 py-1 font-semibold"
                    onClick={() => setMergeView(true)}
                  >
                    Merge Members
                  </button>
                  <button
                    className="text-medium inline-block max-h-fit max-w-fit items-center justify-center rounded-lg bg-red-200 px-3 py-1 font-semibold"
                    onClick={() => setSplitView(true)}
                  >
                    Separate Members
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
