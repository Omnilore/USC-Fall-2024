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

export default function DonationReports() {
  const [customRange, setCustomRange] = useState(false);
  const [availableYears, setAvailableYears] = useState<string[]>([]);

  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [donationTransactions, setDonationTransactions] = useState<
    {
      transaction_email: string;
      date: string;
      amount: number;
      name: string;
      type: string;
      address: string;
      first_name?: string;
      last_name?: string;
      member_id?: number | null;
      partner_id?: number | null;
      partner_name?: string;
    }[]
  >([]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [reportSummary, setReportSummary] = useState<{
      totalAmount: number;
      totalDonors: number;
    }>({
      totalAmount: 0,
      totalDonors: 0,
    });

  // Sorting state with localStorage persistence
  const [selectedSort, setSelectedSort] = useState<string>("default");
  const [selectedSortWay, setSelectedSortWay] = useState<"asc" | "desc">("asc");
  const sortOptions = ["default", "first_name", "last_name", "date", "amount"];

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSort = localStorage.getItem("donation_report_sort");
      const savedSortWay = localStorage.getItem("donation_report_sort_way");
      if (savedSort) setSelectedSort(savedSort);
      if (savedSortWay) setSelectedSortWay(savedSortWay as "asc" | "desc");
    }
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("donation_report_sort", selectedSort);
    }
  }, [selectedSort]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("donation_report_sort_way", selectedSortWay);
    }
  }, [selectedSortWay]);

  const exportToCSV = () => {
    if (donationTransactions.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = ["Name", "Email", "Address", "Date", "Amount", "Type"];
    const rows = donationTransactions.map((t) => [
      t.name ?? "",
      t.transaction_email ?? "",
      t.address ?? "",
      new Date(t.date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      t.amount.toFixed(2),
      t.type ?? "",
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((r) =>
        r.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\r\n");

    const yearsString =
      selectedYears.length > 0 ? selectedYears.join("_") : "all";
    let filename = "";

    if (customRange && startDate && endDate) {
      filename = `donation_report_${startDate}_to_${endDate}.csv`;
    } else {
      filename = `donation_report_${yearsString}.csv`;
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
    if (donationTransactions.length === 0) {
      alert("No data to export");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Donation Report");

    worksheet.columns = [
      { header: "Name", key: "name", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Address", key: "address", width: 40 },
      { header: "Date", key: "date", width: 12 },
      { header: "Amount", key: "amount", width: 12 },
      { header: "Type", key: "type", width: 15 },
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

    donationTransactions.forEach((t, idx) => {
      const row = worksheet.addRow({
        name: t.name ?? "",
        email: t.transaction_email ?? "",
        address: t.address ?? "",
        date: new Date(t.date),
        amount: t.amount,
        type: t.type ?? "",
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

    const yearsString =
      selectedYears.length > 0 ? selectedYears.join("_") : "all";
    let filename = "";

    if (customRange && startDate && endDate) {
      filename = `donation_report_${startDate}_to_${endDate}.xlsx`;
    } else {
      filename = `donation_report_${yearsString}.xlsx`;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, filename);
  };

  const fetchDonationTransactions = async () => {
    if (customRange && (!startDate || !endDate)) {
      alert("Please select both start and end dates");
      return;
    }

    if (!customRange && selectedYears.length === 0) {
      alert("Please select at least one calendar year");
      return;
    }

    console.log('fetchDonationTransactions - selectedYears:', selectedYears);

    const { data: products, error: productError } = await supabase
      .from("products")
      .select("sku")
      .eq("type", "DONATION");

    if (productError) {
      console.error("Error fetching donation SKUs", productError);
      return;
    }

    console.log('Donation products:', products);

    const donationSkus = products
      .map((p) => p.sku)
      .filter((sku) => sku !== "SQ-TEST");

    console.log('Donation SKUs (excluding SQ-TEST):', donationSkus);

    if (donationSkus.length === 0) {
      setDonationTransactions([]);
      return;
    }

    const { data: mtt, error: mttError } = await supabase
      .from("members_to_transactions")
      .select("transaction_id, member_id")
      .in("sku", donationSkus);

    console.log('members_to_transactions with donation SKUs:', mtt?.length || 0);

    if (mttError) {
      console.error("Error fetching members_to_transactions", mttError);
      return;
    }

    const transactionIds = mtt.map((t) => t.transaction_id).filter(Boolean);
    const memberIds = mtt.map((t) => t.member_id).filter(Boolean);

    if (transactionIds.length === 0) {
      setDonationTransactions([]);
      return;
    }

    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("id, transaction_email, date, amount")
      .in("id", transactionIds);

    if (txError) {
      console.error("Error fetching transactions", txError);
      return;
    }

    const { data: memberInfo, error: memberError } = await supabase
      .from("members")
      .select(
        "id, first_name, last_name, type, street_address, city, state, zip_code, partner_id",
      )
      .in("id", memberIds);

    if (memberError) {
      console.error("Error fetching member info", memberError);
      return;
    }

    const membersById = new Map(memberInfo.map((m) => [m.id, m]));

    const memberMap = Object.fromEntries(
      memberInfo.map((m) => {
        const partner = m.partner_id
          ? membersById.get(m.partner_id)
          : undefined;

        return [
          m.id,
          {
            first_name: m.first_name,
            last_name: m.last_name,
            name: `${m.first_name} ${m.last_name}`,
            type: m.type,
            street_address: m.street_address,
            city: m.city,
            state: m.state,
            zip_code: m.zip_code,
            partner_id: m.partner_id ?? null,
            partner_name: partner
              ? `${partner.first_name ?? ""} ${partner.last_name ?? ""}`.trim()
              : "",
          },
        ];
      }),
    );

    const cutoff = new Date("2023-07-01");

    const filtered = transactions
      .filter((t) => {
        const txDate = new Date(t.date);
        if (txDate < cutoff) return false;
        if (customRange) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          return txDate >= start && txDate <= end;
        } else {
          const txYear = txDate.getFullYear().toString();
          return selectedYears.includes(txYear);
        }
      })
      .map((t) => {
        const memberEntry = mtt.find((m) => m.transaction_id === t.id);
        const member = memberMap[memberEntry?.member_id ?? ""];
        const addressParts = [
          member?.street_address,
          member?.city,
          [member?.state, member?.zip_code].filter(Boolean).join(" "),
        ].filter(Boolean);

        return {
          transaction_email: t.transaction_email,
          date: t.date,
          address: addressParts.join(", "),
          amount: t.amount,
          name: member?.name ?? "Unknown",
          first_name: member?.first_name ?? "",
          last_name: member?.last_name ?? "",
          type: member?.type ?? "UNKNOWN",
          member_id: memberEntry?.member_id ?? null,
          partner_id: member?.partner_id ?? null,
          partner_name: member?.partner_name ?? "",
        };
      });

    const uniqueDonors = new Set(filtered.map(d => d.member_id));
    const totalAmount = filtered.reduce((sum, d) => sum + (d.amount || 0), 0);
    const totalDonors = uniqueDonors.size;

    setReportSummary({
      totalAmount,
      totalDonors,
    });

    setDonationTransactions(filtered);
  };

  useEffect(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = 2023; y <= currentYear; y++) {
      years.push(y.toString());
    }
    setAvailableYears(years);
  }, []);

  // Apply sorting to donation transactions
  const sortedDonations = useMemo(() => {
    if (selectedSort === "default") return donationTransactions;

    return donationTransactions.toSorted((a, b) => {
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

      // Handle date sorting
      if (selectedSort === "date") {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return selectedSortWay === "asc"
          ? dateA.getTime() - dateB.getTime()
          : dateB.getTime() - dateA.getTime();
      }

      // Handle amount (numeric) sorting
      if (selectedSort === "amount") {
        return selectedSortWay === "asc"
          ? a.amount - b.amount
          : b.amount - a.amount;
      }

      return 0;
    });
  }, [donationTransactions, selectedSort, selectedSortWay]);
  const { registerRow, focusPartner, highlightedId } = usePartnerNavigation();

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
                    <div className="flex w-2/3 flex-col">
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
                  )}
                  <div className="flex w-1/3 items-end">
                    <button
                      className="h-10 w-full cursor-pointer rounded-lg bg-gray-200 font-semibold"
                      onClick={() => setCustomRange((prev) => !prev)}
                    >
                      {customRange ? "Calendar Year" : "Custom Range"}
                    </button>
                  </div>
                </div>
                <div className="flex w-1/3 flex-row justify-between gap-2">
                  <div className="flex w-1/3 items-end">
                    <button
                      onClick={fetchDonationTransactions}
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
              {donationTransactions.length > 0 && (
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
                      Total Donors
                    </h3>
                    <p className="text-lg font-bold text-black">
                      {reportSummary.totalDonors}
                    </p>
                    <p className="text-xs text-black">
                      unique members
                    </p>
                  </div>
                </div>
              )}

              <div className="w-full grow overflow-y-auto">
                <table className="w-full border-collapse rounded-xl bg-white text-left shadow-sm">
                  <thead>
                    <tr>
                      <th className="sticky top-0 z-20 rounded-xl bg-white p-3 font-semibold">
                        Name
                      </th>
                      <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                        Email
                      </th>
                      <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                        Address
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
                      <th className="sticky top-0 z-20 rounded-xl bg-white p-3 font-semibold">
                        Partner
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDonations.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="p-3 text-center text-gray-500"
                        >
                          No donations found
                        </td>
                      </tr>
                    ) : (
                      sortedDonations.map((t, i) => (
                        <tr
                          key={i}
                          ref={registerRow(t.member_id ?? null)}
                          className={cn(
                            "border-t transition-colors",
                            highlightedId === t.member_id
                              ? "bg-yellow-200"
                              : i % 2 === 1
                                ? "bg-orange-50"
                                : "",
                          )}
                        >
                          <td className="p-3">{t.name}</td>
                          <td className="p-3">{t.transaction_email}</td>
                          <td className="p-3">{t.address}</td>
                          <td className="p-3">
                            {new Date(t.date).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          <td className="p-3">${t.amount.toFixed(2)}</td>
                          <td className="p-3">{t.type}</td>
                          <td className="p-3">
                            {t.partner_id ? (
                              <button
                                onClick={() =>
                                  focusPartner({
                                    partnerId: t.partner_id ?? null,
                                    partnerName: t.partner_name,
                                  })
                                }
                                className="text-blue-600 underline-offset-2 hover:underline"
                              >
                                {t.partner_name || "View Partner"}
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
