"use client";

import { supabase } from "@/app/supabase";
import { useState, useEffect, useMemo } from "react";
import { getRoles } from "@/app/supabase";
import MultiSelectDropdown from "@/components/ui/MultiSelectDropdown";
import SelectDropdown from "@/components/ui/SelectDropdown";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { usePartnerNavigation } from "@/hooks/use-partner-navigation";
import { cn } from "@/lib/utils";

export default function ForumReports() {
  const [customRange, setCustomRange] = useState(false);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [availableTrimesters] = useState([
    "Trimester 1",
    "Trimester 2",
    "Trimester 3",
  ]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedTrimesters, setSelectedTrimesters] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [reportSummary, setReportSummary] = useState<{
      totalAmount: number;
      totalAttendees: number;
    }>({
      totalAmount: 0,
      totalAttendees: 0,
    });
  const [forumMembers, setForumMembers] = useState<
    {
      name: string;
      email: string;
      phone: string;
      type: string;
      date: string;
      amount: number;
      descriptor: string;
      first_name?: string;
      last_name?: string;
      member_id?: number | null;
      partner_id?: number | null;
      partner_name?: string;
    }[]
  >([]);

  // Sorting state with localStorage persistence
  const [selectedSort, setSelectedSort] = useState<string>("default");
  const [selectedSortWay, setSelectedSortWay] = useState<"asc" | "desc">("asc");
  const sortOptions = ["default", "first_name", "last_name", "amount"];

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSort = localStorage.getItem("forum_report_sort");
      const savedSortWay = localStorage.getItem("forum_report_sort_way");
      if (savedSort) setSelectedSort(savedSort);
      if (savedSortWay) setSelectedSortWay(savedSortWay as "asc" | "desc");
    }
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("forum_report_sort", selectedSort);
    }
  }, [selectedSort]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("forum_report_sort_way", selectedSortWay);
    }
  }, [selectedSortWay]);

  useEffect(() => {
    const setup = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("year")
        .eq("type", "FORUM");

      if (error) {
        console.error("Failed to fetch FORUM years", error);
        return;
      }

      const uniqueYears = Array.from(
        new Set(data.map((p) => p.year).filter((y): y is string => y !== null)),
      ).sort();

      setAvailableYears(uniqueYears);
      if (uniqueYears.length > 0) {
        setSelectedYears([uniqueYears[uniqueYears.length - 1]]);
      }
    };
    setup().catch(console.error);
  }, []);

  const formatPhoneNumber = (phone: string | null): string => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) return phone;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const getGroupIds = (years: string[], trimesters: string[]) => {
    const trimesterNumberMap: Record<string, string> = {
      "Trimester 1": "1",
      "Trimester 2": "2",
      "Trimester 3": "3",
    };
    const groupIds: string[] = [];
    for (const year of years) {
      const shortYear = year.slice(2);
      for (const trimester of trimesters) {
        groupIds.push(`${shortYear}-${trimesterNumberMap[trimester]}`);
      }
    }
    return groupIds;
  };

  const fetchForumReport = async () => {
    if (customRange && (!startDate || !endDate)) {
      alert("Please select both start and end dates");
      return;
    }

    if (
      !customRange &&
      (selectedYears.length === 0 || selectedTrimesters.length === 0)
    ) {
      alert("Please select at least one calendar year and one trimester");
      return;
    }

    const groupIds = getGroupIds(selectedYears, selectedTrimesters);

    const { data: products, error: productError } = await supabase
      .from("products")
      .select("sku, descriptor")
      .eq("type", "FORUM")
      .in("group_id", groupIds);

    if (productError) {
      console.error("Error fetching FORUM SKUs", productError);
      return;
    }
    const skuDescriptorMap = Object.fromEntries(
      products.map((p) => [p.sku, p.descriptor ?? ""]),
    );
    const forumSkus = products
      .map((p) => p.sku)
      .filter((sku) => sku !== "SQ-TEST");

    const { data: mtt, error: mttError } = await supabase
      .from("members_to_transactions")
      .select("member_id, transaction_id, sku")
      .in("sku", forumSkus);

    if (mttError) {
      console.error("Error fetching members_to_transactions", mttError);
      return;
    }

    let filteredMemberIds: (string | number)[] = [];

    const transactionIds = mtt.map((row) => row.transaction_id).filter(Boolean);

    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("id, date, amount")
      .in("id", transactionIds);

    if (txError) {
      console.error("Error fetching transactions", txError);
      return;
    }

    // Build transaction map
    const transactionMap = Object.fromEntries(
      transactions.map((tx) => [tx.id, { date: tx.date, amount: tx.amount }]),
    );

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
      setForumMembers([]);
      return;
    }

    const { data: members, error: memberError } = await supabase
      .from("members")
      .select("id, first_name, last_name, email, phone, type, partner_id")
      .in("id", filteredMemberIds.map(Number));

    if (memberError) {
      console.error("Error fetching member data", memberError);
      return;
    }

    const membersById = new Map(members.map((m) => [m.id, m]));

    const memberMap = Object.fromEntries(
      members.map((m) => [
        String(m.id),
        {
          ...m,
          partner_id: m.partner_id ?? null,
          partner_name: m.partner_id
            ? (() => {
                const partner = membersById.get(m.partner_id);
                return partner
                  ? `${partner.first_name ?? ""} ${partner.last_name ?? ""}`.trim()
                  : "";
              })()
            : "",
        },
      ]),
    );

    const formatted = mtt
      .map((entry) => {
        const member = memberMap[String(entry.member_id)];
        const tx = transactionMap[entry.transaction_id];

        return {
          name: `${member?.first_name ?? ""} ${member?.last_name ?? ""}`,
          first_name: member?.first_name ?? "",
          last_name: member?.last_name ?? "",
          email: member?.email ?? "",
          phone: formatPhoneNumber(member?.phone ?? ""),
          type: member?.type ?? "",
          date: tx?.date ?? "",
          amount: tx?.amount ?? 0,
          descriptor: skuDescriptorMap[entry.sku] ?? "",
          member_id: member?.id ?? null,
          partner_id: member?.partner_id ?? null,
          partner_name: member?.partner_name ?? "",
        };
      });

      const uniqueMembers = new Set(formatted.map(m => m.member_id));
      const totalAmount = formatted.reduce((sum, m) => sum + (m.amount || 0), 0);
      const totalAttendees = uniqueMembers.size;

      setReportSummary({
        totalAmount,
        totalAttendees,
      });

    setForumMembers(formatted);
  };

  const exportToCSV = () => {
    if (forumMembers.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = [
      "Name",
      "Email",
      "Phone",
      "Date",
      "Amount",
      "Type",
      "Descriptor",
    ];
    const rows = forumMembers.map((m) => [
      m.name ?? "",
      m.email ?? "",
      m.phone ?? "",
      new Date(m.date).toLocaleDateString(),
      m.amount.toFixed(2),
      m.type ?? "",
      m.descriptor ?? "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) =>
        r.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\r\n");

    const trimesterMap: Record<string, string> = {
      "Trimester 1": "t1",
      "Trimester 2": "t2",
      "Trimester 3": "t3",
    };

    const yearsString =
      selectedYears.length > 0 ? selectedYears.join("_") : "all";

    let filename = "";
    if (customRange && startDate && endDate) {
      filename = `forum_report_${startDate}_to_${endDate}.csv`;
    } else {
      let trimestersString = "";
      if (selectedTrimesters.length > 0 && selectedTrimesters.length < 3) {
        trimestersString = selectedTrimesters
          .map((t) => trimesterMap[t] || t)
          .join("_");
      }
      filename = trimestersString
        ? `forum_report_${yearsString}_${trimestersString}.csv`
        : `forum_report_${yearsString}.csv`;
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
    if (forumMembers.length === 0) {
      alert("No data to export");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Forum Report");

    worksheet.columns = [
      { header: "Name", key: "name", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone", width: 18 },
      { header: "Date", key: "date", width: 12 },
      { header: "Amount", key: "amount", width: 12 },
      { header: "Type", key: "type", width: 15 },
      { header: "Descriptor", key: "descriptor", width: 35 },
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

    forumMembers.forEach((m, idx) => {
      const row = worksheet.addRow({
        name: m.name ?? "",
        email: m.email ?? "",
        phone: m.phone ?? "",
        date: new Date(m.date),
        amount: m.amount,
        type: m.type ?? "",
        descriptor: m.descriptor ?? "",
      });

      row.getCell(4).numFmt = "mmm dd, yyyy";
      row.getCell(5).numFmt = "$#,##0.00";

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

    const trimesterMap: Record<string, string> = {
      "Trimester 1": "t1",
      "Trimester 2": "t2",
      "Trimester 3": "t3",
    };

    const yearsString =
      selectedYears.length > 0 ? selectedYears.join("_") : "all";

    let filename = "";
    if (customRange && startDate && endDate) {
      filename = `forum_report_${startDate}_to_${endDate}.xlsx`;
    } else {
      let trimestersString = "";
      if (selectedTrimesters.length > 0 && selectedTrimesters.length < 3) {
        trimestersString = selectedTrimesters
          .map((t) => trimesterMap[t] || t)
          .join("_");
      }
      filename = trimestersString
        ? `forum_report_${yearsString}_${trimestersString}.xlsx`
        : `forum_report_${yearsString}.xlsx`;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, filename);
  };

  // Apply sorting to forum members
  const sortedForumMembers = useMemo(() => {
    if (selectedSort === "default") return forumMembers;

    return forumMembers.toSorted((a, b) => {
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

      // Handle amount (numeric) sorting
      if (selectedSort === "amount") {
        return selectedSortWay === "asc"
          ? a.amount - b.amount
          : b.amount - a.amount;
      }

      return 0;
    });
  }, [forumMembers, selectedSort, selectedSortWay]);
  const { registerRow, focusPartner, highlightedId } = usePartnerNavigation();

  return (
    <div className="flex h-full w-full flex-col bg-gray-100">
      <div className="flex w-full grow flex-col items-center justify-center overflow-y-auto">
        <div className="flex h-[95%] w-[98%] flex-row items-center gap-4">
          <div className="flex h-full w-full flex-col items-center">
            <div className="flex h-full w-full flex-col gap-3">
              <div className="flex w-full flex-row items-end justify-between gap-2">
                {/* Sorting Controls */}
                <div className="flex w-1/5 flex-row gap-2">
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

                <div className="flex w-3/5 flex-row justify-between gap-2">
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
                          className="h-10 w-full rounded-lg border-gray-200 bg-white p-2"
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
                          className="h-10 w-full rounded-lg border-gray-200 bg-white p-2"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex w-1/3 flex-col">
                        <label className="text-sm font-semibold">
                          Calendar Year(s)
                        </label>
                        <MultiSelectDropdown
                          options={availableYears}
                          selectedOptions={selectedYears}
                          setSelectedOptions={setSelectedYears}
                          placeholder="Select Calendar Year(s)"
                        />
                      </div>
                      <div className="flex w-1/3 flex-col">
                        <label className="text-sm font-semibold">
                          Trimester(s)
                        </label>
                        <MultiSelectDropdown
                          options={availableTrimesters}
                          selectedOptions={selectedTrimesters}
                          setSelectedOptions={setSelectedTrimesters}
                          placeholder="Select Trimester(s)"
                        />
                      </div>
                    </>
                  )}
                  <div className="flex w-1/3 items-end">
                    <button
                      className="h-10 w-full cursor-pointer rounded-lg bg-gray-200 font-semibold"
                      onClick={() => {
                        setCustomRange((prev) => !prev);
                        setForumMembers([]);
                      }}
                    >
                      {customRange ? "Calendar Year" : "Custom Range"}
                    </button>
                  </div>
                </div>
                <div className="flex w-1/3 flex-row justify-between gap-2">
                  <div className="flex w-1/3 items-end">
                    <button
                      onClick={fetchForumReport}
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
              {forumMembers.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-lg border border-slate-300 bg-slate-100 p-3">
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
                  <div className="rounded-lg border border-blue-300 bg-blue-100 p-3">
                    <h3 className="mb-1 text-xs font-semibold text-black">
                      Total Attendees
                    </h3>
                    <p className="text-lg font-bold text-black">
                      {reportSummary.totalAttendees}
                    </p>
                    <p className="text-xs text-black">
                      unique members
                    </p>
                  </div>
                </div>
              )}
              <div className="w-full grow overflow-y-auto rounded-xl">
                <table className="custom-scrollbar w-full border-collapse rounded-lg bg-white text-left shadow-sm">
                  <thead>
                    <tr>
                      <th className="sticky top-0 z-20 rounded-xl bg-white p-3 font-semibold">
                        Name
                      </th>
                      <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                        Email
                      </th>
                      <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                        Phone
                      </th>
                      <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                        Date
                      </th>
                      <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                        Amount
                      </th>
                      <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                        Type
                      </th>
                      <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                        Descriptor
                      </th>
                      <th className="sticky top-0 z-20 rounded-xl bg-white p-3 font-semibold">
                        Partner
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedForumMembers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="p-3 text-center text-gray-500"
                        >
                          No forum participants found
                        </td>
                      </tr>
                    ) : (
                      sortedForumMembers.map((m, i) => (
                        <tr
                          key={i}
                          ref={registerRow(m.member_id ?? null)}
                          className={cn(
                            "border-t transition-colors",
                            highlightedId === m.member_id
                              ? "bg-yellow-200"
                              : i % 2 === 1
                                ? "bg-orange-50"
                                : "",
                          )}
                        >
                          <td className="p-3">{m.name}</td>
                          <td className="p-3">{m.email}</td>
                          <td className="p-3">{m.phone}</td>
                          <td className="p-3">
                            {new Date(m.date).toLocaleDateString()}
                          </td>
                          <td className="p-3">${m.amount.toFixed(2)}</td>
                          <td className="p-3">{m.type}</td>
                          <td className="p-3">{m.descriptor}</td>
                          <td className="p-3">
                            {m.partner_id ? (
                              <button
                                onClick={() =>
                                  focusPartner({
                                    partnerId: m.partner_id ?? null,
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
                      ))
                    )}
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
