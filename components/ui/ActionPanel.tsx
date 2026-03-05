import { useEffect, useState, useRef } from "react";
import InputField from "@/components/ui/InputField";
import { getTableSchema, supabase } from "@/app/supabase";
import { SupabaseProduct } from "@/app/api/cron/src/supabase/types";
import { getProducts, TableName } from "@/app/queryFunctions";
import { toast } from "sonner";
import UserIcon from "@/components/assets/user-icon.png";

interface ActionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTable: TableName;
  mode: string;
  primaryKeys: string[];
  selectedRow?: Record<string, any>;
  reloadData: () => Promise<void>;
}

export default function ActionPanel({
  isOpen,
  onClose,
  selectedTable,
  mode,
  selectedRow,
  primaryKeys,
  reloadData,
}: ActionPanelProps) {
  const [fields, setFields] = useState<
    Map<
      string,
      {
        name: string;
        type: string;
        nullable: boolean;
        isAutoIncrement: boolean;
        isArray: boolean;
        isEnum: boolean;
        enumValues: string[];
      }
    >
  >(new Map());
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [userFormData, setUserFormData] = useState<Record<string, any>>({});
  const [products, setProducts] = useState<SupabaseProduct[]>([]);
  const [instanceId, setInstanceId] = useState<number>(0);
  const [memberStatusOptions, setMemberStatusOptions] = useState<string[]>([]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const strip_empty_fields = (obj: Record<string, any>) => {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, value]) => value !== null && value !== undefined)
        .map(([key, value]) => [
          // sets date fields to null if empty string
          key,
          value === "" && fields.get(key)?.type === "date" ? null : value,
        ]),
    );
  };

  useEffect(() => {
    if (isOpen) {
      fetchSchema();
      document.body.style.overflow = "hidden";

      // Scroll to top when panel opens
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }

      // Reset form state fresh each open
      if (mode === "edit" && selectedRow) {
        setFormData(selectedRow);
        setUserFormData({});
      } else {
        setFormData({});
        setUserFormData({});
      }

      // Bump instance so field components remount and clear internal state
      setInstanceId((x) => x + 1);
    } else {
      // Clear form data when panel is closing so next open is clean
      setFormData({});
      setUserFormData({});
      document.body.style.overflow = "auto";
    }
  }, [isOpen, selectedTable, mode, selectedRow]);

  useEffect(() => {
    if (isOpen) {
      getProducts().then((products) => setProducts(products));
      
      // Fetch unique member status values from database if editing members table
      if (selectedTable === "members") {
        fetchMemberStatusOptions();
      }
    }
  }, [isOpen, selectedTable]);

  const fetchMemberStatusOptions = async () => {
    try {
      const { data, error } = await supabase
        .from("members")
        .select("member_status");

      if (error) {
        console.error("Failed to fetch member status options", error);
        return;
      }

      // Define all possible member status codes including new ones
      const allStatuses = [
        "LOAM", "LOAE", 
        "YrE", "YrM",
        "1TriE", "1TriM", 
        "2TriE", "2TriM", 
        "LSE", "LSM",
        "2TriLSM", "2TriLSE",  // NEW
        "1TriLSE", "1TriLSM",  // NEW
        "Deceased", "Expired"
      ];

      // Get unique status values from database, normalize Diceased -> Deceased
      const dbStatuses = [...new Set(data?.map(m => {
        if (m.member_status === 'Diceased') return 'Deceased';
        return m.member_status;
      }).filter(Boolean) as string[])];

      // Combine database values with all defined statuses, remove duplicates
      const combinedStatuses = [...new Set([...allStatuses, ...dbStatuses])].sort();

      setMemberStatusOptions(combinedStatuses);
    } catch (error) {
      console.error("Error fetching member status options:", error);
    }
  };

  const fetchSchema = async () => {
    const schema = await getTableSchema(selectedTable);
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
      setFields(new Map(fieldList.map((field) => [field.name, field])));
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-white/50 transition-opacity"
          onClick={onClose}
        ></div>
      )}

      <div
        className={`fixed right-0 bottom-0 z-50 h-[90%] w-1/3 transform rounded-tl-xl border bg-white shadow-lg ${isOpen ? "translate-x-0" : "translate-x-full"
          } transition-transform duration-250`}
      >
        <div className="flex h-full flex-col">
          <div className="flex flex-col border-b p-4">
            <div className="flex justify-between">
              {mode === "add" ? (
                <div className="text-medium inline-block max-w-fit rounded-3xl bg-[#C9FFAE] px-4 py-1 italic">
                  <span className="font-semibold">adding </span>
                  <span className="font-light">new row to </span>
                  <span className="font-semibold">{selectedTable}</span>
                </div>
              ) : (
                <div className="text-medium inline-block max-w-fit rounded-3xl bg-[#E5E7EB] px-4 py-1 italic">
                  <span className="font-semibold">editing </span>
                  <span className="font-light">row in </span>
                  <span className="font-semibold">{selectedTable}</span>
                </div>
              )}

              <button
                className="inline-block max-w-fit text-xl text-[#616161]"
                onClick={() => {
                  // ensure state is cleared when closing via X
                  setFormData({});
                  setUserFormData({});
                  onClose();
                }}
              >
                ✖
              </button>
            </div>
          </div>

          <div
            ref={scrollContainerRef}
            className="custom-scrollbar flex h-full w-full flex-col gap-8 overflow-hidden overflow-y-auto p-8"
          >
            {Array.from(fields.values())
              .filter(
                (field) =>
                  field.name !== "created_at" &&
                  field.name !== "updated_at" &&
                  !(
                    field.isAutoIncrement && primaryKeys.includes(field.name)
                  ) &&
                  !["json", "jsonb"].includes(field.type),
              )
              .map(
                ({
                  name,
                  type,
                  nullable,
                  isAutoIncrement,
                  isArray,
                  isEnum,
                  enumValues,
                }) => {
                  // Check if this is a photo field
                  if (name === "photo_path" || name === "photo_link") {
                    return (
                      <div
                        key={`${instanceId}-${name}-${type}-${selectedRow?.[name]}`}
                        className="flex flex-col gap-3"
                      >
                        <label className="font-medium capitalize">
                          {name.replace(/_/g, " ")}
                        </label>
                        <div className="flex flex-col gap-4">
                          {/* Image preview */}
                          <div className="flex items-center justify-center">
                            <div className="h-48 w-48 overflow-hidden rounded-lg border border-gray-200 shadow-sm">
                              {formData[name] ? (
                                <img
                                  src={formData[name]}
                                  alt="Photo preview"
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    // Fallback to placeholder if image loading fails
                                    e.currentTarget.src = UserIcon.src;
                                  }}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-gray-50">
                                  <img
                                    src={UserIcon.src}
                                    alt="No photo"
                                    className="h-24 w-24 opacity-30"
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Input field for the URL */}
                          <InputField
                            fieldName={name}
                            fieldType={type}
                            required={!nullable}
                            value={formData[name]}
                            isAutoIncrement={isAutoIncrement}
                            isArray={isArray}
                            isEnum={isEnum}
                            isSKU={false}
                            products={products}
                            setFormValue={setUserFormData}
                            enumValues={enumValues}
                            mode={mode}
                          />
                        </div>
                      </div>
                    );
                  }

                  // Gender dropdown field
                  if (name === "gender") {
                    return (
                      <div key={name} className="flex flex-col gap-3">
                        <label className="font-medium capitalize">
                          {name.replace(/_/g, " ")}
                        </label>
                        <select
                          value={formData[name] || ""}
                          onChange={(e) => setUserFormData({
                            ...userFormData,
                            [name]: e.target.value || null
                          })}
                          className="w-full rounded-lg border border-gray-200 p-2"
                        >
                          <option value="">Select Gender</option>
                          <option value="M">Male</option>
                          <option value="F">Female</option>
                          <option value="Other">Other</option>
                          <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                      </div>
                    );
                  }

                  // Member status dropdown field - Uses dynamic values from database
                  if (name === "member_status") {
                    return (
                      <div key={name} className="flex flex-col gap-3">
                        <label className="font-medium capitalize">
                          {name.replace(/_/g, " ")}
                        </label>
                        <select
                          value={formData[name] || ""}
                          onChange={(e) => setUserFormData({
                            ...userFormData,
                            [name]: e.target.value || null
                          })}
                          className="w-full rounded-lg border border-gray-200 p-2"
                        >
                          <option value="">Select Status</option>
                          {memberStatusOptions.length > 0 ? (
                            memberStatusOptions.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))
                          ) : (
                            // Fallback to common values if not loaded yet
                            <>
                              <option value="Active">Active</option>
                              <option value="Inactive">Inactive</option>
                              <option value="Leave of Absence">Leave of Absence</option>
                              <option value="Deceased">Deceased</option>
                              <option value="Expired">Expired</option>
                            </>
                          )}
                        </select>
                      </div>
                    );
                  }


                  // Regular fields
                  return (
                    <InputField
                      key={`${instanceId}-${name}-${type}-${selectedRow?.[name]}`}
                      fieldName={name}
                      fieldType={type}
                      required={!nullable}
                      value={formData[name]}
                      isAutoIncrement={isAutoIncrement}
                      isArray={isArray}
                      isEnum={isEnum}
                      isSKU={["sku", "skus"].includes(name)}
                      products={products}
                      setFormValue={setUserFormData}
                      enumValues={enumValues}
                      mode={mode}
                    />
                  );
                },
              )}
            <div className="flex w-full justify-start gap-2">
              <button
                className="text-medium inline-block max-h-fit max-w-fit cursor-pointer items-center justify-center rounded-lg bg-gray-100 px-3 py-1"
                onClick={onClose}
              >
                Cancel
              </button>

              <button
                className={`text-medium inline-block max-h-fit max-w-fit cursor-pointer rounded-lg px-3 py-1 font-semibold ${mode === "add" ? "bg-[#C9FFAE]" : "bg-[#E5E7EB]"} items-center justify-center`}
                onClick={async () => {
                  if (mode === "add") {
                    const { error } = await supabase
                      .from(selectedTable)
                      .insert(strip_empty_fields(userFormData));

                    if (error) {
                      toast.error(`Error inserting data. ${error.message}`);
                    } else {
                      toast.success("Inserted successfully.");
                      reloadData();
                      onClose();
                    }
                  }

                  if (mode === "edit") {
                    const { error } = await supabase
                      .from(selectedTable)
                      .update(
                        strip_empty_fields({ ...formData, ...userFormData }),
                      )
                      .match(
                        Object.fromEntries(
                          primaryKeys.map((key) => [key, formData[key]]),
                        ),
                      );

                    if (error) {
                      toast.error(`Error updating data. ${error.message}`);
                    } else {
                      toast.success("Updated successfully.");
                      reloadData();
                      onClose();
                    }
                  }
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
