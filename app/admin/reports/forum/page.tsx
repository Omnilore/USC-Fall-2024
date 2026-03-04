"use client";

import { supabase } from "@/app/supabase";
import { useState, useEffect } from "react";
import { getRoles } from "@/app/supabase";
import MultiSelectDropdown from "@/components/ui/MultiSelectDropdown";

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
  const [forumMembers, setForumMembers] = useState<
    {
      name: string;
      email: string;
      phone: string;
      type: string;
      date: string;
      amount: number;
      descriptor: string;
    }[]
  >([]);

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
      .select("member_id, transaction_id, sku, amount")
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
      .select("id, first_name, last_name, email, phone, type")
      .in("id", filteredMemberIds.map(Number));

    if (memberError) {
      console.error("Error fetching member data", memberError);
      return;
    }

    const memberMap = Object.fromEntries(members.map((m) => [String(m.id), m]));

    // Filter mtt entries based on custom range if applicable
    let filteredMtt = mtt;
    if (customRange) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      filteredMtt = mtt.filter((row) => {
        const tx = transactionMap[row.transaction_id];
        if (!tx) return false;
        const txDate = new Date(tx.date);
        return txDate >= start && txDate <= end;
      });
    }

    const formatted = filteredMtt
      .map((entry) => {
        const member = memberMap[String(entry.member_id)];
        const tx = transactionMap[entry.transaction_id];

        return {
          name: `${member?.first_name ?? ""} ${member?.last_name ?? ""}`,
          email: member?.email ?? "",
          phone: formatPhoneNumber(member?.phone ?? ""),
          type: member?.type ?? "",
          date: tx?.date ?? "",
          amount: entry.amount ?? 0,
          descriptor: skuDescriptorMap[entry.sku] ?? "",
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

  return (
    <div className="flex h-full w-full flex-col bg-gray-100">
      <div className="flex w-full grow flex-col items-center justify-center overflow-y-auto">
        <div className="flex h-[95%] w-[98%] flex-row items-center gap-4">
          <div className="flex h-full w-full flex-col items-center">
            <div className="flex h-full w-full flex-col gap-3">
              <div className="flex w-full flex-row items-end justify-between">
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
                <div className="flex w-1/4 flex-row justify-between gap-2">
                  <div className="flex w-1/2 items-end">
                    <button
                      onClick={fetchForumReport}
                      className="h-10 w-full cursor-pointer rounded-lg bg-blue-500 font-semibold text-white"
                    >
                      Generate Report
                    </button>
                  </div>
                  <div className="flex w-1/2 items-end">
                    <button
                      className="h-10 w-full cursor-pointer rounded-lg bg-green-500 font-semibold text-white"
                      onClick={exportToCSV}
                    >
                      Export as CSV
                    </button>
                  </div>
                </div>
              </div>
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
                      <th className="sticky top-0 z-20 rounded-xl bg-white p-3 font-semibold">
                        Descriptor
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {forumMembers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-3 text-center text-gray-500"
                        >
                          No forum participants found
                        </td>
                      </tr>
                    ) : (
                      forumMembers.map((m, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-3">{m.name}</td>
                          <td className="p-3">{m.email}</td>
                          <td className="p-3">{m.phone}</td>
                          <td className="p-3">
                            {new Date(m.date).toLocaleDateString()}
                          </td>
                          <td className="p-3">${m.amount.toFixed(2)}</td>
                          <td className="p-3">{m.type}</td>
                          <td className="p-3">{m.descriptor}</td>
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
