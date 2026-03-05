"use client";

import { supabase } from "@/app/supabase";
import { useState, useEffect, useMemo } from "react";
import MultiSelectDropdown from "@/components/ui/MultiSelectDropdown";
import SelectDropdown from "@/components/ui/SelectDropdown";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { ChevronUp, ChevronDown, X } from "lucide-react";

const AVAILABLE_FIELDS = [
  { key: "first_name", label: "First Name", category: "Basic Info" },
  { key: "last_name", label: "Last Name", category: "Basic Info" },
  { key: "alias", label: "Alias", category: "Basic Info" },
  { key: "email", label: "Email", category: "Contact" },
  { key: "phone", label: "Phone", category: "Contact" },
  { key: "street_address", label: "Street Address", category: "Address" },
  { key: "city", label: "City", category: "Address" },
  { key: "state", label: "State", category: "Address" },
  { key: "zip_code", label: "Zip Code", category: "Address" },
  { key: "emergency_contact", label: "Emergency Contact", category: "Emergency" },
  { key: "emergency_contact_phone", label: "Emergency Phone", category: "Emergency" },
  { key: "member_status", label: "Member Status", category: "Membership" },
  { key: "expiration_date", label: "Expiration Date", category: "Membership" },
  { key: "type", label: "Member Type", category: "Membership" },
  { key: "gender", label: "Gender", category: "Demographics" },
  { key: "partner_id", label: "Partner ID", category: "Relationships" },
  { key: "partner_name", label: "Partner Name", category: "Relationships" },
  { key: "photo_link", label: "Photo URL", category: "Basic Info" },
];

export default function AdHocReport() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);

  const [selectedFields, setSelectedFields] = useState<string[]>([
    "first_name",
    "last_name",
    "email",
    "phone",
  ]);

  const [filters, setFilters] = useState<{
    memberStatus: string[];
    memberType: string[];
    gender: string[];
    yearFilter: string;
    customYears: string[];
    hasPartner: string;
    membershipComparison: string;
  }>({
    memberStatus: [],
    memberType: [],
    gender: [],
    yearFilter: "all",
    customYears: [],
    hasPartner: "all",
    membershipComparison: "none",
  });

  const [sortField, setSortField] = useState<string>("last_name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [filterOptions, setFilterOptions] = useState<{
    memberStatus: string[];
    memberType: string[];
    gender: string[];
    years: string[];
  }>({
    memberStatus: [],
    memberType: [],
    gender: [],
    years: [],
  });

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("members")
        .select(`
          id, first_name, last_name, alias, email, phone,
          street_address, city, state, zip_code,
          emergency_contact, emergency_contact_phone,
          member_status, expiration_date, type, gender,
          photo_link, partner_id
        `);

      if (error) {
        console.error("Failed to fetch members", error);
        return;
      }

      const memberMap = new Map(data?.map(m => [m.id, `${m.first_name} ${m.last_name}`]) || []);

      const membersWithPartners = data?.map(member => ({
        ...member,
        partner_name: member.partner_id ? memberMap.get(member.partner_id) || "" : ""
      })) || [];

      setMembers(membersWithPartners);

      const uniqueStatus = [...new Set(data?.map(m => {
        if (m.member_status === 'Diceased') return 'Deceased';
        return m.member_status;
      }).filter(Boolean) as string[])].sort();

      const uniqueType = [...new Set(data?.map(m => m.type).filter(Boolean) as string[])].sort();
      
      const uniqueGender = [...new Set(data?.map(m => {
        if (!m.gender) return null;
        const g = m.gender.toUpperCase();
        if (g === 'FEMALE' || g === 'F') return 'F';
        if (g === 'MALE' || g === 'M') return 'M';
        return g;
      }).filter(Boolean) as string[])].sort();
      
      const years = (data
        ?.map(m => m.expiration_date ? new Date(m.expiration_date).getFullYear().toString() : null)
        .filter(Boolean) as string[]) || [];
      const uniqueYears = [...new Set(years)].sort((a, b) => parseInt(b) - parseInt(a));

      setFilterOptions({
        memberStatus: uniqueStatus,
        memberType: uniqueType,
        gender: uniqueGender,
        years: uniqueYears,
      });
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const filteredMembers = useMemo(() => {
    const filtered = members.filter(member => {
      if (filters.memberStatus.length > 0) {
        let status = member.member_status;
        if (status === 'Diceased') status = 'Deceased';
        if (!filters.memberStatus.includes(status)) {
          return false;
        }
      }

      if (filters.memberType.length > 0 && !filters.memberType.includes(member.type)) {
        return false;
      }

      if (filters.gender.length > 0) {
        let gender = member.gender;
        if (gender) {
          const g = gender.toUpperCase();
          if (g === 'FEMALE' || g === 'F') gender = 'F';
          else if (g === 'MALE' || g === 'M') gender = 'M';
        }
        if (!filters.gender.includes(gender)) {
          return false;
        }
      }

      if (filters.hasPartner === "with_partner" && !member.partner_id) {
        return false;
      }
      if (filters.hasPartner === "without_partner" && member.partner_id) {
        return false;
      }

      if (filters.yearFilter === "current") {
        const currentYear = new Date().getFullYear();
        const expirationYear = member.expiration_date ? new Date(member.expiration_date).getFullYear() : null;
        if (!expirationYear || expirationYear < currentYear) return false;
      } else if (filters.yearFilter === "expired") {
        const currentYear = new Date().getFullYear();
        const expirationYear = member.expiration_date ? new Date(member.expiration_date).getFullYear() : null;
        if (!expirationYear || expirationYear >= currentYear) return false;
      } else if (filters.yearFilter === "custom" && filters.customYears.length > 0) {
        const expirationYear = member.expiration_date ? new Date(member.expiration_date).getFullYear().toString() : null;
        if (!expirationYear || !filters.customYears.includes(expirationYear)) return false;
      }
      // Replace the membership comparison section in the filteredMembers useMemo
      // Find this section in your code (around line 188):

      if (filters.membershipComparison === "last_year_not_this_year") {
        const now = new Date();
        const expirationDate = member.expiration_date 
          ? new Date(member.expiration_date) 
          : null;
        
        // No expiration date = exclude
        if (!expirationDate) {
          return false;
        }
        
        // Academic year starts September 2nd
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-indexed (0 = January, 8 = September)
        const currentDay = now.getDate();
        
        // Determine when the current academic year started
        let currentAcademicYearStart: Date;
        if (currentMonth < 8 || (currentMonth === 8 && currentDay < 2)) {
          // Before September 2nd - current academic year started Sept 2 of LAST year
          // Example: Today is Jan 15, 2025 → current year started Sept 2, 2024
          currentAcademicYearStart = new Date(currentYear - 1, 8, 2);
        } else {
          // On or after September 2nd - current academic year started Sept 2 of THIS year
          // Example: Today is Oct 1, 2025 → current year started Sept 2, 2025
          currentAcademicYearStart = new Date(currentYear, 8, 2);
        }
        
        // Check if member expired BEFORE the current academic year started
        const expiredBeforeCurrentYear = expirationDate < currentAcademicYearStart;
        
        // Check if still marked as MEMBER (should be NONMEMBER)
        const stillMarkedAsMember = member.type !== "NONMEMBER";
        
        // Only include members who meet BOTH conditions:
        // 1. Expired before current academic year started (had membership last year but not this year)
        // 2. Still marked as MEMBER type (need status update to NONMEMBER + Expired)
        return expiredBeforeCurrentYear && stillMarkedAsMember;
      }


      return true;
    });

    return filtered;
  }, [members, filters]);

  const sortedMembers = useMemo(() => {
    if (!sortField) return filteredMembers;

    return [...filteredMembers].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === "asc" ? 1 : -1;
      if (bVal == null) return sortDirection === "asc" ? -1 : 1;

      if (sortField === "expiration_date") {
        const dateA = new Date(aVal);
        const dateB = new Date(bVal);
        return sortDirection === "asc" 
          ? dateA.getTime() - dateB.getTime()
          : dateB.getTime() - dateA.getTime();
      }

      const comparison = String(aVal).localeCompare(String(bVal));
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredMembers, sortField, sortDirection]);

  const formatPhoneNumber = (phone: string | null): string => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) return phone;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const formatValue = (key: string, value: any): string => {
    if (value == null) return "";
    if (key.toLowerCase().includes("phone")) return formatPhoneNumber(value);
    if ((key === "expiration_date") && value) {
      return new Date(value).toLocaleDateString();
    }
    if (key === "gender" && value) {
      const g = value.toUpperCase();
      if (g === 'FEMALE' || g === 'F') return 'F';
      if (g === 'MALE' || g === 'M') return 'M';
      return value;
    }
    if (key === "member_status" && value === "Diceased") {
      return "Deceased";
    }
    return String(value);
  };

  const moveFieldUp = (index: number) => {
    if (index === 0) return;
    const newFields = [...selectedFields];
    [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
    setSelectedFields(newFields);
  };

  const moveFieldDown = (index: number) => {
    if (index === selectedFields.length - 1) return;
    const newFields = [...selectedFields];
    [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
    setSelectedFields(newFields);
  };

  const removeField = (field: string) => {
    setSelectedFields(selectedFields.filter(f => f !== field));
  };

  const addField = (field: string) => {
    if (!selectedFields.includes(field)) {
      setSelectedFields([...selectedFields, field]);
    }
  };

  const handleGenerateReport = () => {
    if (selectedFields.length === 0) {
      alert("Please select at least one field");
      return;
    }
    setReportGenerated(true);
  };

  const exportToCSV = () => {
    if (sortedMembers.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = selectedFields.map(
      key => AVAILABLE_FIELDS.find(f => f.key === key)?.label || key
    );

    const rows = sortedMembers.map(member =>
      selectedFields.map(key => formatValue(key, member[key]))
    );

    const csvContent = [
      headers.join(","),
      ...rows.map(r =>
        r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\r\n");

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `adhoc_report_${timestamp}.csv`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToXLSX = async () => {
    if (sortedMembers.length === 0) {
      alert("No data to export");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Ad-Hoc Report");

    worksheet.columns = selectedFields.map(key => ({
      header: AVAILABLE_FIELDS.find(f => f.key === key)?.label || key,
      key: key,
      width: 20,
    }));

    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    worksheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };

    sortedMembers.forEach((member, idx) => {
      const rowData: any = {};
      selectedFields.forEach(key => {
        rowData[key] = formatValue(key, member[key]);
      });

      const row = worksheet.addRow(rowData);

      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFD3D3D3" } },
          bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
          left: { style: "thin", color: { argb: "FFD3D3D3" } },
          right: { style: "thin", color: { argb: "FFD3D3D3" } },
        };
      });

      if (idx % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF2F2F2" },
          };
        });
      }
    });

    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `adhoc_report_${timestamp}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, filename);
  };

  const clearFilters = () => {
    setFilters({
      memberStatus: [],
      memberType: [],
      gender: [],
      yearFilter: "all",
      customYears: [],
      hasPartner: "all",
      membershipComparison: "none",
    });
    setReportGenerated(false);
  };

  return (
    <div className="flex h-full w-full flex-col bg-gray-100">
      <div className="flex w-full grow flex-col items-center overflow-y-auto">
        <div className="flex h-[95%] w-[98%] flex-col gap-4 py-4">
          
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Ad-Hoc Report Generator</h1>
            <div className="flex gap-2">
              <button
                onClick={handleGenerateReport}
                disabled={selectedFields.length === 0}
                className="cursor-pointer rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Generate Report
              </button>
              <button
                onClick={exportToCSV}
                disabled={sortedMembers.length === 0 || !reportGenerated}
                className="cursor-pointer rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Export to CSV
              </button>
              <button
                onClick={exportToXLSX}
                disabled={sortedMembers.length === 0 || !reportGenerated}
                className="cursor-pointer rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Export to XLSX
              </button>
            </div>
          </div>

          {!reportGenerated ? (
            <div className="grid h-full grid-cols-3 gap-4">
              
              <div className="rounded-lg bg-white p-4 shadow">
                <h2 className="mb-3 text-lg font-semibold">Select Fields</h2>
                
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-semibold">Available Fields</label>
                  <div className="max-h-48 overflow-y-auto rounded border border-gray-300 p-2">
                    {AVAILABLE_FIELDS.filter(f => !selectedFields.includes(f.key)).map(field => (
                      <div
                        key={field.key}
                        onClick={() => addField(field.key)}
                        className="cursor-pointer rounded px-2 py-1 text-sm hover:bg-blue-50"
                      >
                        {field.label}
                        <span className="ml-2 text-xs text-gray-500">({field.category})</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">Selected Fields (in order)</label>
                  <div className="max-h-64 overflow-y-auto rounded border border-gray-300 p-2">
                    {selectedFields.length === 0 ? (
                      <p className="text-sm text-gray-500">No fields selected</p>
                    ) : (
                      selectedFields.map((fieldKey, index) => {
                        const field = AVAILABLE_FIELDS.find(f => f.key === fieldKey);
                        return (
                          <div
                            key={fieldKey}
                            className="mb-1 flex items-center justify-between rounded bg-blue-50 px-2 py-1 text-sm"
                          >
                            <span>{field?.label || fieldKey}</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => moveFieldUp(index)}
                                disabled={index === 0}
                                className="rounded p-1 hover:bg-blue-100 disabled:opacity-30"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                onClick={() => moveFieldDown(index)}
                                disabled={index === selectedFields.length - 1}
                                className="rounded p-1 hover:bg-blue-100 disabled:opacity-30"
                              >
                                <ChevronDown size={14} />
                              </button>
                              <button
                                onClick={() => removeField(fieldKey)}
                                className="rounded p-1 text-red-600 hover:bg-red-50"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-4 shadow">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Filters</h2>
                  <button
                    onClick={clearFilters}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Clear All
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-semibold">Member Status</label>
                    <MultiSelectDropdown
                      options={filterOptions.memberStatus}
                      selectedOptions={filters.memberStatus}
                      setSelectedOptions={(selected) => 
                        setFilters({...filters, memberStatus: selected})
                      }
                      placeholder="All Statuses"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold">Member Type</label>
                    <MultiSelectDropdown
                      options={filterOptions.memberType}
                      selectedOptions={filters.memberType}
                      setSelectedOptions={(selected) => 
                        setFilters({...filters, memberType: selected})
                      }
                      placeholder="All Types"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold">Gender</label>
                    <MultiSelectDropdown
                      options={filterOptions.gender}
                      selectedOptions={filters.gender}
                      setSelectedOptions={(selected) => 
                        setFilters({...filters, gender: selected})
                      }
                      placeholder="All"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold">Partner Status</label>
                    <SelectDropdown
                      options={["all", "with_partner", "without_partner"]}
                      selectedOption={filters.hasPartner}
                      setSelectedOption={(selected) => 
                        setFilters({...filters, hasPartner: selected})
                      }
                    />
                  </div>
                  

                  <div>
                    <label className="mb-1 block text-sm font-semibold">Membership Year</label>
                    <SelectDropdown
                      options={["all", "current", "expired", "custom"]}
                      selectedOption={filters.yearFilter}
                      setSelectedOption={(selected) => 
                        setFilters({...filters, yearFilter: selected})
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold">Find Members Needing Status Update</label>
                    <SelectDropdown
                      options={[
                        "none",
                        "last_year_not_this_year",
                      ]}
                      selectedOption={filters.membershipComparison}
                      setSelectedOption={(selected) => 
                        setFilters({...filters, membershipComparison: selected})
                      }
                    />
                    {filters.membershipComparison === "last_year_not_this_year" && (
                      <p className="mt-1 text-xs text-gray-600">
                          Shows members whose membership has already expired (expiration date in the past) and are still marked as MEMBER type. These members should be updated to type NONMEMBER with status Expired.
                      </p>
                    )}
                  </div>

                  {filters.yearFilter === "custom" && (
                    <div>
                      <label className="mb-1 block text-sm font-semibold">Select Years</label>
                      <MultiSelectDropdown
                        options={filterOptions.years}
                        selectedOptions={filters.customYears}
                        setSelectedOptions={(selected) => 
                          setFilters({...filters, customYears: selected})
                        }
                        placeholder="Select years"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-white p-4 shadow">
                <h2 className="mb-3 text-lg font-semibold">Sorting</h2>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-semibold">Sort By</label>
                    <SelectDropdown
                      options={selectedFields.length > 0 ? selectedFields : ["last_name"]}
                      selectedOption={sortField}
                      setSelectedOption={setSortField}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {AVAILABLE_FIELDS.find(f => f.key === sortField)?.label || sortField}
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold">Direction</label>
                    <SelectDropdown
                      options={["asc", "desc"]}
                      selectedOption={sortDirection}
                      setSelectedOption={(dir) => setSortDirection(dir as "asc" | "desc")}
                    />
                  </div>

                  <div className="mt-4 rounded bg-gray-50 p-3">
                    <p className="text-sm font-semibold">Results Summary</p>
                    <p className="text-2xl font-bold text-blue-600">{sortedMembers.length}</p>
                    <p className="text-xs text-gray-600">members will be in report</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden rounded-lg bg-white shadow">
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-gray-200 p-4">
                  <div>
                    <h2 className="text-lg font-semibold">Generated Report</h2>
                    <p className="text-sm text-gray-600">
                      Showing {selectedFields.length} field(s) for {sortedMembers.length} member(s)
                    </p>
                  </div>
                  <button
                    onClick={() => setReportGenerated(false)}
                    className="rounded-lg bg-gray-500 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-600"
                  >
                    Back to Options
                  </button>
                </div>

                <div className="custom-scrollbar flex-1 overflow-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-gray-100">
                      <tr>
                        {selectedFields.map(fieldKey => {
                          const field = AVAILABLE_FIELDS.find(f => f.key === fieldKey);
                          return (
                            <th key={fieldKey} className="border-b border-gray-200 p-3 text-left font-semibold">
                              {field?.label || fieldKey}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={selectedFields.length} className="p-8 text-center text-gray-500">
                            Loading members...
                          </td>
                        </tr>
                      ) : sortedMembers.length === 0 ? (
                        <tr>
                          <td colSpan={selectedFields.length} className="p-8 text-center text-gray-500">
                            No members match your criteria
                          </td>
                        </tr>
                      ) : (
                        sortedMembers.map((member, idx) => (
                          <tr
                            key={member.id}
                            className={`border-b ${idx % 2 === 1 ? "bg-orange-50" : ""}`}
                          >
                            {selectedFields.map(fieldKey => (
                              <td key={fieldKey} className="p-3">
                                {formatValue(fieldKey, member[fieldKey])}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
