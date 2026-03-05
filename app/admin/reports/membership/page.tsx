"use client";

import { supabase } from "@/app/supabase";
import { useState, useEffect, useMemo } from "react";
import MultiSelectDropdown from "@/components/ui/MultiSelectDropdown";
import SelectDropdown from "@/components/ui/SelectDropdown";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { usePartnerNavigation } from "@/hooks/use-partner-navigation";
import { cn } from "@/lib/utils";

export default function MembershipReports() {
  const [members, setMembers] = useState<any[]>([]);
  const [customRange, setCustomRange] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [reportSummary, setReportSummary] = useState<{
    totalMembers: number;
    totalAmount: number;
  }>({
    totalMembers: 0,
    totalAmount: 0,
  });

  // Sorting state with localStorage persistence
  const [selectedSort, setSelectedSort] = useState<string>("default");
  const [selectedSortWay, setSelectedSortWay] = useState<"asc" | "desc">("asc");
  const sortOptions = ["default", "first_name", "last_name", "expiration_date", "member_status"];

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSort = localStorage.getItem("membership_report_sort");
      const savedSortWay = localStorage.getItem("membership_report_sort_way");
      if (savedSort) setSelectedSort(savedSort);
      if (savedSortWay) setSelectedSortWay(savedSortWay as "asc" | "desc");
    }
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("membership_report_sort", selectedSort);
    }
  }, [selectedSort]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("membership_report_sort_way", selectedSortWay);
    }
  }, [selectedSortWay]);

  // Column filters state - only for specific columns
  const [filters, setFilters] = useState<Record<string, string>>({
    member_status: "",
    expiration_date: "",
    gender: "",
    type: "",
    delivery_method: ""
  });

  // Get unique values for dropdown filters
  const uniqueValues = useMemo(() => {
    return {
      member_status: [...new Set(members.map(m => m.member_status).filter(Boolean))].sort(),
      gender: [...new Set(members.map(m => m.gender).filter(Boolean))].sort(),
      type: [...new Set(members.map(m => m.type).filter(Boolean))].sort(),
      delivery_method: [...new Set(members.map(m => m.delivery_method).filter(Boolean))].sort(),
    };
  }, [members]);

  // Apply filters to members
  const filteredMembers = useMemo(() => {
    return members.filter(member => {
      return Object.entries(filters).every(([key, filterValue]) => {
        if (!filterValue) return true;
        const memberValue = String(member[key] || "");
        return memberValue === filterValue;
      });
    });
  }, [members, filters]);

  // Apply sorting to filtered members
  const sortedMembers = useMemo(() => {
    if (selectedSort === "default") return filteredMembers;

    return filteredMembers.toSorted((a, b) => {
      // Handle first_name sorting (include last_name as secondary)
      if (selectedSort === "first_name") {
        const aName = `${a.first_name || ""} ${a.last_name || ""}`;
        const bName = `${b.first_name || ""} ${b.last_name || ""}`;
        return selectedSortWay === "asc"
          ? aName.localeCompare(bName)
          : bName.localeCompare(aName);
      }

      // Handle last_name sorting (include first_name as secondary)
      if (selectedSort === "last_name") {
        const aName = `${a.last_name || ""} ${a.first_name || ""}`;
        const bName = `${b.last_name || ""} ${b.first_name || ""}`;
        return selectedSortWay === "asc"
          ? aName.localeCompare(bName)
          : bName.localeCompare(aName);
      }

      // Handle expiration_date sorting
      if (selectedSort === "expiration_date") {
        const dateA = a.expiration_date ? new Date(a.expiration_date) : new Date(0);
        const dateB = b.expiration_date ? new Date(b.expiration_date) : new Date(0);
        return selectedSortWay === "asc"
          ? dateA.getTime() - dateB.getTime()
          : dateB.getTime() - dateA.getTime();
      }

      // Handle member_status (string) sorting
      if (selectedSort === "member_status") {
        const aStatus = a.member_status || "";
        const bStatus = b.member_status || "";
        return selectedSortWay === "asc"
          ? aStatus.localeCompare(bStatus)
          : bStatus.localeCompare(aStatus);
      }

      // Default string comparison
      return selectedSortWay === "asc"
        ? (a[selectedSort] || "").toString().localeCompare((b[selectedSort] || "").toString())
        : (b[selectedSort] || "").toString().localeCompare((a[selectedSort] || "").toString());
    });
  }, [filteredMembers, selectedSort, selectedSortWay]);
  const { registerRow, focusPartner, highlightedId } = usePartnerNavigation();

  const exportToCSV = () => {
  if (filteredMembers.length === 0) {
    alert("No data to export");
    return;
  }

  const headers = [
    "Name",
    "Address",
    "Phone",
    "Email",
    "Emergency Contact",
    "Emergency Phone",
    "Status",
    "Expiration",
    "Gender",
    "Member Type",
    "Delivery Method",
    "Partner Name"
  ];

  const rows = filteredMembers.map((m) => [
    m.name ?? "",
    m.address ?? "",
    m.phone ?? "",
    m.email ?? "",
    m.emergency_contact ?? "",
    m.emergency_contact_phone ?? "",
    m.member_status ?? "",
    m.expiration_date ?? "",
    m.gender ?? "",
    m.type ?? "",
    m.delivery_method ?? "Email",
    m.partner_name ?? ""
  ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) =>
        r.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\r\n");

    let filename = "";
    if (customRange && startDate && endDate) {
      filename = `membership_report_${startDate}_to_${endDate}.csv`;
    } else {
      const yearsString =
        selectedYears.length > 0
          ? selectedYears.map(formatAcademicYear).join("_")
          : "all";
      filename = `membership_report_${yearsString}.csv`;
    }

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
  if (filteredMembers.length === 0) {
    alert("No data to export");
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Membership Report");

  worksheet.columns = [
    { header: "Name", key: "name", width: 25 },
    { header: "Address", key: "address", width: 40 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Email", key: "email", width: 30 },
    { header: "Emergency Contact", key: "emergency_contact", width: 25 },
    { header: "Emergency Phone", key: "emergency_phone", width: 18 },
    { header: "Status", key: "status", width: 15 },
    { header: "Expiration", key: "expiration", width: 12 },
    { header: "Gender", key: "gender", width: 10 },
    { header: "Member Type", key: "type", width: 15 },
    { header: "Delivery Method", key: "delivery_method", width: 15 },
    { header: "Partner Name", key: "partner_name", width: 25 },
  ];

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

    filteredMembers.forEach((m, idx) => {
  const row = worksheet.addRow({
    name: m.name ?? "",
    address: m.address ?? "",
    phone: m.phone ?? "",
    email: m.email ?? "",
    emergency_contact: m.emergency_contact ?? "",
    emergency_phone: m.emergency_contact_phone ?? "",
    status: m.member_status ?? "",
    expiration: m.expiration_date ? new Date(m.expiration_date) : "",
    gender: m.gender ?? "",
    type: m.type ?? "",
    delivery_method: m.delivery_method ?? "Email",
    partner_name: m.partner_name ?? "",
  });

  if (m.expiration_date) {
    row.getCell(8).numFmt = "yyyy-mm-dd";
  }

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

    let filename = "";
    if (customRange && startDate && endDate) {
      filename = `membership_report_${startDate}_to_${endDate}.xlsx`;
    } else {
      const yearsString =
        selectedYears.length > 0
          ? selectedYears.map(formatAcademicYear).join("_")
          : "all";
      filename = `membership_report_${yearsString}.xlsx`;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, filename);
  };

  const formatAcademicYear = (shortYear: string): string => {
    if (!shortYear || !shortYear.includes("-")) return shortYear;
    const [start, end] = shortYear.split("-").map((y) => parseInt(y, 10));
    const fullStart = start < 50 ? 2000 + start : 1900 + start;
    const fullEnd = end < 50 ? 2000 + end : 1900 + end;
    return `${fullStart}–${fullEnd}`;
  };

  const formatPhoneNumber = (phone: string | null): string => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) return phone;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const fetchMembershipMembers = async () => {
      if (customRange && (!startDate || !endDate)) {
        alert("Please select both start and end dates");
        return;
      }

      console.log('fetchMembershipMembers - selectedYears:', selectedYears);

      // Get statuses from BOTH products AND members
      const { data: products, error: productError } = await supabase
        .from("products")
        .select("sku, status")
        .eq("type", "MEMBERSHIP")
        .in("year", selectedYears);

      console.log('Found products:', products?.length);

      if (productError) {
        console.error("Failed to fetch membership SKUs", productError);
        return;
      }

      // Also get unique statuses directly from members table
      const { data: memberStatuses, error: memberStatusError } = await supabase
        .from("members")
        .select("member_status")
        .not("member_status", "is", null);

      if (memberStatusError) {
        console.error("Failed to fetch member statuses", memberStatusError);
      }

      // Combine both sources - ADD NULL CHECK HERE
      const productStatuses = products?.map(p => p.status).filter(Boolean) || [];
      const directStatuses = memberStatuses?.map(m => m.member_status).filter(Boolean) || [];
      const allUniqueStatuses = [...new Set([...productStatuses, ...directStatuses])].sort();

      console.log('All unique statuses found:', allUniqueStatuses);

      const skuStatusMap = Object.fromEntries(
        products.map((p) => [p.sku, p.status ?? ""]),
      );

      const validSkus = products
        .map((p) => p.sku)
        .filter((sku) => sku !== "SQ-TEST");

      if (validSkus.length === 0) {
        setMembers([]);
        return;
      }

    const { data: mtt, error: mttError } = await supabase
      .from("members_to_transactions")
      .select("member_id, transaction_id, sku")
      .in("sku", validSkus);

    if (mttError) {
      console.error("Failed to fetch members_to_transactions", mttError);
      return;
    }

    let filteredMemberIds: (string | number)[] = [];

    if (customRange) {
      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select("id, date");

      if (txError) {
        console.error("Failed to fetch transactions", txError);
        return;
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      const validTxIds = transactions
        .filter((tx) => {
          const txDate = new Date(tx.date);
          return txDate >= start && txDate <= end;
        })
        .map((tx) => tx.id);

      filteredMemberIds = mtt
        .filter((row) => validTxIds.includes(row.transaction_id))
        .map((row) => row.member_id);
    } else {
      filteredMemberIds = mtt.map((row) => row.member_id);
    }

    if (filteredMemberIds.length === 0) {
      setMembers([]);
      return;
    }

    const { data: membersData, error: membersError } = await supabase
      .from("members")
      .select(`
        id, first_name, last_name, street_address, city, state, zip_code,
        phone, email, emergency_contact, emergency_contact_phone,
        member_status, expiration_date, gender, type, partner_id
      `)
      .in("id", filteredMemberIds.map(Number));

    if (membersError) {
      console.error("Failed to fetch members", membersError);
      return;
    }

    const memberMap = new Map(
      membersData.map((m) => [
        m.id,
        {
          name: `${m.first_name} ${m.last_name}`,
          first_name: m.first_name,
          last_name: m.last_name,
        },
      ]),
    );

const formatted = mtt
  .map((row) => {
    const m = membersData.find((mem) => mem.id === row.member_id);
    const addressParts = [
      m?.street_address,
      m?.city,
      [m?.state, m?.zip_code].filter(Boolean).join(" "),
    ].filter(Boolean);
    
    const partnerName = m?.partner_id
      ? memberMap.get(m.partner_id)?.name || ""
      : "";

    let gender = m?.gender || "";
    if (gender) {
      const g = gender.toUpperCase();
      if (g === 'FEMALE' || g === 'F') gender = 'F';
      else if (g === 'MALE' || g === 'M') gender = 'M';
    }
    
    return {
      id: m?.id,
      first_name: m?.first_name ?? "",
      last_name: m?.last_name ?? "",
      name: `${m?.first_name} ${m?.last_name}`,
      address: addressParts.join(", "),
      phone: formatPhoneNumber(m?.phone ?? ""),
      email: m?.email ?? "",
      emergency_contact: m?.emergency_contact,
      emergency_contact_phone: formatPhoneNumber(
        m?.emergency_contact_phone ?? "",
      ),
      member_status: m?.member_status ?? skuStatusMap[row.sku] ?? "",      expiration_date: m?.expiration_date,
      gender: gender,
      type: m?.type ?? "",
      delivery_method: "Email",
      partner_name: partnerName,
      partner_id: m?.partner_id ?? null,
    };
  })


      .sort((a, b) => {
        const lastNameCompare = a.last_name.localeCompare(b.last_name);
        if (lastNameCompare !== 0) return lastNameCompare;
        return a.first_name.localeCompare(b.first_name);
      });

    const memberIds = formatted.map(m => m.id).filter((id): id is number => !!id);

    if (memberIds.length > 0) {
      const { data: transactionData, error: txError } = await supabase
        .from('members_to_transactions')
        .select('transaction_id, member_id, sku')
        .in('member_id', memberIds)
        .in('sku', validSkus);

      if (!txError && transactionData) {
        const txIds = transactionData.map(t => t.transaction_id);
        
        const { data: txAmounts, error: amountError } = await supabase
          .from('transactions')
          .select('id, amount')
          .in('id', txIds);

        if (!amountError && txAmounts) {
          const totalAmount = txAmounts.reduce((sum, tx) => sum + (tx.amount || 0), 0);
          
          setReportSummary({
            totalMembers: formatted.length,
            totalAmount,
          });
        }
      }
    } else {
      setReportSummary({
        totalMembers: 0,
        totalAmount: 0,
      });
    }
    
      setMembers(formatted);
  };

  useEffect(() => {
    const setup = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("year")
        .eq("type", "MEMBERSHIP");

      if (error) {
        console.error("Failed to fetch years", error);
        return;
      }

      const uniqueYears = Array.from(
        new Set(data.map((p) => p.year).filter((y): y is string => y !== null)),
      ).sort();
      setAvailableYears(uniqueYears);
      setSelectedYears([uniqueYears[uniqueYears.length - 1]]);
    };
    setup().catch(console.error);
  }, []);

  return (
    <div className="flex h-full w-full flex-col bg-gray-100">
      <div className="flex w-full grow flex-col items-center justify-center overflow-y-auto">
        <div className="flex h-[95%] w-[98%] flex-row items-center gap-4">
          <div className="flex h-full w-full flex-col items-center">
            <div className="flex h-full w-full flex-col gap-3">
              <div className="flex w-full flex-row items-end justify-between gap-2">
                {/* Sorting Controls */}
                <div className="flex w-1/4 flex-row gap-2">
                  <div className="flex w-1/2 flex-col">
                    <label className="text-sm font-semibold">Sort By</label>
                    <SelectDropdown
                      options={sortOptions}
                      selectedOption={selectedSort}
                      setSelectedOption={(sort) => setSelectedSort(sort)}
                    />
                  </div>
                  <div className="flex w-1/2 flex-col">
                    <label className="text-sm font-semibold">Order</label>
                    <SelectDropdown
                      options={["asc", "desc"]}
                      selectedOption={selectedSortWay}
                      setSelectedOption={(way) => setSelectedSortWay(way as "asc" | "desc")}
                    />
                  </div>
                </div>

                <div className="flex w-1/2 flex-row justify-between gap-2">
                  {customRange ? (
                    <>
                      <div className="flex w-1/3 flex-col">
                        <label className="text-sm font-semibold">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="h-10 w-full cursor-pointer rounded-lg border-gray-200 bg-white p-2"
                        />
                      </div>
                      <div className="flex w-1/3 flex-col">
                        <label className="text-sm font-semibold">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="h-10 w-full cursor-pointer rounded-lg border-gray-200 bg-white p-2"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex w-2/3 flex-col">
                        <div className="flex w-full flex-col">
                          <label className="text-sm font-semibold">
                            Academic Year
                          </label>
                          <MultiSelectDropdown
                            options={availableYears.map((year) =>
                              formatAcademicYear(year),
                            )}
                            selectedOptions={selectedYears.map((y) =>
                              formatAcademicYear(y),
                            )}
                            setSelectedOptions={(formattedSelected) => {
                              const rawSelected = availableYears.filter((y) =>
                                formattedSelected.includes(
                                  formatAcademicYear(y),
                                ),
                              );
                              setSelectedYears(rawSelected);
                            }}
                            placeholder="Select Academic Year(s)"
                          />
                        </div>
                      </div>
                    </>
                  )}
                  <div className="flex w-1/3 items-end">
                    <button
                      className="h-10 w-full cursor-pointer rounded-lg bg-gray-200 font-semibold"
                      onClick={() => setCustomRange((prev) => !prev)}
                    >
                      {customRange ? "Academic Year" : "Custom Range"}
                    </button>
                  </div>
                </div>
                <div className="flex w-1/3 flex-row justify-between gap-2">
                  <div className="flex w-1/3 items-end">
                    <button
                      onClick={fetchMembershipMembers}
                      className="h-8 w-full cursor-pointer rounded-lg bg-blue-500 text-sm font-semibold text-white"
                    >
                      Generate Report
                    </button>
                  </div>
                  <div className="flex w-1/3 items-end">
                    <button
                      className="h-8 w-full cursor-pointer rounded-lg bg-red-500 text-sm font-semibold text-white"
                      onClick={exportToCSV}
                    >
                      Export to CSV
                    </button>
                  </div>
                  <div className="flex w-1/3 items-end">
                    <button
                      className="h-8 w-full cursor-pointer rounded-lg bg-green-600 text-sm font-semibold text-white"
                      onClick={exportToXLSX}
                    >
                      Export to XLSX
                    </button>
                  </div>
                </div>
              </div>
              {members.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-lg border border-slate-300 bg-slate-100 p-3">
                    <h3 className="mb-1 text-xs font-semibold text-black">
                      Total Members
                    </h3>
                    <p className="text-lg font-bold text-black">
                      {reportSummary.totalMembers}
                    </p>
                  </div>
                  <div className="rounded-lg border border-blue-300 bg-blue-100 p-3">
                    <h3 className="mb-1 text-xs font-semibold text-black">
                      Total Amount
                    </h3>
                    <p className="text-lg font-bold text-black">
                      ${reportSummary.totalAmount.toLocaleString('en-US', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </p>
                  </div>
                </div>
              )}
              {/* Table with dropdown filters */}
              <div className="w-full grow overflow-y-auto rounded-xl">
                <table className="custom-scrollbar w-full border-collapse rounded-lg bg-white text-left shadow-sm">
                  <thead>
                    <tr>
                      <th className="sticky top-0 z-20 rounded-xl bg-white p-3 font-semibold">
                        Name
                      </th>
                      <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                        Address
                      </th>
                      <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                        Phone
                      </th>
                      <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                        Email
                      </th>
                      <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                        Emergency Contact
                      </th>
                      <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                        Emergency Phone
                      </th>
                      <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                        Status
                      </th>
                      <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                        Expiration
                      </th>
                      <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                        Gender
                      </th>
                      <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                        Member Type
                      </th>
                      <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                        Delivery Method
                      </th>
                      <th className="sticky top-0 z-20 rounded-xl bg-white p-3 font-semibold">
                        Partner Name
                      </th>
                    </tr>
                    {/* Filter Row - only for specific columns */}
                    <tr>
                      <th className="sticky top-[52px] z-10 bg-gray-50 p-2"></th>
                      <th className="sticky top-[52px] z-10 bg-gray-50 p-2"></th>
                      <th className="sticky top-[52px] z-10 bg-gray-50 p-2"></th>
                      <th className="sticky top-[52px] z-10 bg-gray-50 p-2"></th>
                      <th className="sticky top-[52px] z-10 bg-gray-50 p-2"></th>
                      <th className="sticky top-[52px] z-10 bg-gray-50 p-2"></th>
                      {/* Status Filter */}
                      <th className="sticky top-[52px] z-10 bg-gray-50 p-2">
                        <select
                          value={filters.member_status}
                          onChange={(e) => setFilters({ ...filters, member_status: e.target.value })}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        >
                          <option value="">All</option>
                          {uniqueValues.member_status.map(val => (
                            <option key={val} value={val}>{val}</option>
                          ))}
                        </select>
                      </th>
                      {/* Expiration Filter */}
                      <th className="sticky top-[52px] z-10 bg-gray-50 p-2"></th>
                      {/* Gender Filter */}
                      <th className="sticky top-[52px] z-10 bg-gray-50 p-2">
                        <select
                          value={filters.gender}
                          onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        >
                          <option value="">All</option>
                          {uniqueValues.gender.map(val => (
                            <option key={val} value={val}>{val}</option>
                          ))}
                        </select>
                      </th>
                      {/* Member Type Filter */}
                      <th className="sticky top-[52px] z-10 bg-gray-50 p-2">
                        <select
                          value={filters.type}
                          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        >
                          <option value="">All</option>
                          {uniqueValues.type.map(val => (
                            <option key={val} value={val}>{val}</option>
                          ))}
                        </select>
                      </th>
                      {/* Delivery Method Filter */}
                      <th className="sticky top-[52px] z-10 bg-gray-50 p-2">
                        <select
                          value={filters.delivery_method}
                          onChange={(e) => setFilters({ ...filters, delivery_method: e.target.value })}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        >
                          <option value="">All</option>
                          {uniqueValues.delivery_method.map(val => (
                            <option key={val} value={val}>{val}</option>
                          ))}
                        </select>
                      </th>
                      {/* Partner Name Filter */}
                      <th className="sticky top-[52px] z-10 bg-gray-50 p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMembers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={11}
                          className="p-3 text-center text-gray-500"
                        >
                          No members found
                        </td>
                      </tr>
                    ) : (
                      sortedMembers.map((m, i) => (
                        <tr
                          key={i}
                          ref={registerRow(m.id ?? null)}
                          className={cn(
                            "border-t transition-colors",
                            highlightedId === m.id
                              ? "bg-yellow-200"
                              : i % 2 === 1
                                ? "bg-orange-50"
                                : "",
                          )}
                        >
                          <td className="p-3">{m.name}</td>
                          <td className="p-3">{m.address}</td>
                          <td className="p-3">{m.phone}</td>
                          <td className="p-3">{m.email}</td>
                          <td className="p-3">{m.emergency_contact}</td>
                          <td className="p-3">{m.emergency_contact_phone}</td>
                          <td className="p-3">{m.member_status}</td>
                          <td className="p-3">{m.expiration_date}</td>
                          <td className="p-3">{m.gender}</td>
                          <td className="p-3">{m.type}</td>
                          <td className="p-3">{m.delivery_method}</td>
                          <td className="p-3">
                            {m.partner_id ? (
                              <button
                                onClick={() =>
                                  focusPartner({
                                    partnerId: m.partner_id,
                                    partnerName: m.partner_name,
                                  })
                                }
                                className="text-blue-600 underline-offset-2 hover:underline"
                              >
                                {m.partner_name || "View Partner"}
                              </button>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      )))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
