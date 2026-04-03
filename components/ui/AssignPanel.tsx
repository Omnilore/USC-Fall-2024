"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/app/supabase";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssignPanelProps {
  isOpen: boolean;
  onClose: () => void;
  table: "committee_members" | "sdg_members" | "leadership";
  reloadData: () => Promise<void>;
}

interface Member {
  id: number;
  first_name: string;
  last_name: string;
}
interface Committee {
  id: number;
  committee_name: string;
}
interface Sdg {
  id: number;
  sdg: string;
  trimester: string;
}
interface LeadershipPosition {
  id: number;
  leadership_position: string;
}

function Combobox<T extends { id: number }>({
  items,
  value,
  onSelect,
  placeholder,
  searchPlaceholder,
  displayFn,
}: {
  items: T[];
  value: number | null;
  onSelect: (id: number | null) => void;
  placeholder: string;
  searchPlaceholder: string;
  displayFn: (item: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = items.find((item) => item.id === value);

  const filtered = items.filter((item) => {
    const label = displayFn(item) ?? "";
    return label.toLowerCase().includes(search.toLowerCase());
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="border-input flex h-10 w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={cn("truncate", !selected && "text-gray-400")}>
          {selected ? displayFn(selected) : placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-[60] mt-1 w-full rounded-md border bg-white shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none"
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">
                No results found.
              </div>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelect(item.id === value ? null : item.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="relative flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {displayFn(item)}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const TABLE_LABELS: Record<string, string> = {
  committee_members: "committee_members",
  sdg_members: "sdg_members",
  leadership: "leadership",
};

export default function AssignPanel({
  isOpen,
  onClose,
  table,
  reloadData,
}: AssignPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [sdgs, setSdgs] = useState<Sdg[]>([]);
  const [positions, setPositions] = useState<LeadershipPosition[]>([]);
  const [lookupLoaded, setLookupLoaded] = useState(false);

  const [memberId, setMemberId] = useState<number | null>(null);

  const [committeeId, setCommitteeId] = useState<number | null>(null);
  const [position, setPosition] = useState("");
  const [active, setActive] = useState(true);

  const [sdgId, setSdgId] = useState<number | null>(null);

  const [positionId, setPositionId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const resetForm = () => {
    setMemberId(null);
    setCommitteeId(null);
    setPosition("");
    setActive(true);
    setSdgId(null);
    setPositionId(null);
    setStartDate("");
    setEndDate("");
  };

  useEffect(() => {
    if (!isOpen) {
      resetForm();
      document.body.style.overflow = "auto";
      return;
    }
    document.body.style.overflow = "hidden";
    scrollRef.current?.scrollTo(0, 0);

    if (!lookupLoaded) {
      Promise.all([
        supabase
          .from("members")
          .select("id, first_name, last_name")
          .order("last_name"),
        supabase
          .from("committees")
          .select("id, committee_name")
          .order("committee_name"),
        supabase.from("sdgs").select("id, sdg, trimester").order("sdg"),
        supabase
          .from("leadership_positions")
          .select("id, leadership_position")
          .order("leadership_position"),
      ]).then(([mRes, cRes, sRes, pRes]) => {
        if (!mRes.error) setMembers((mRes.data as Member[]) ?? []);
        if (!cRes.error) setCommittees((cRes.data as Committee[]) ?? []);
        if (!sRes.error) setSdgs((sRes.data as Sdg[]) ?? []);
        if (!pRes.error)
          setPositions((pRes.data as LeadershipPosition[]) ?? []);
        setLookupLoaded(true);
      });
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!memberId) {
      toast.error("Please select a member.");
      return;
    }

    if (table === "committee_members" && !committeeId) {
      toast.error("Please select a committee.");
      return;
    }
    if (table === "sdg_members" && !sdgId) {
      toast.error("Please select an SDG.");
      return;
    }
    if (table === "leadership" && !positionId) {
      toast.error("Please select a leadership position.");
      return;
    }

    setSubmitting(true);
    try {
      let error;
      if (table === "committee_members") {
        ({ error } = await supabase.from("committee_members").insert({
          member_id: memberId,
          committee_id: committeeId,
          position: position || null,
          active,
        }));
      } else if (table === "sdg_members") {
        ({ error } = await supabase.from("sdg_members").insert({
          member_id: memberId,
          sdg_id: sdgId,
        }));
      } else {
        ({ error } = await supabase.from("leadership").insert({
          member_id: memberId,
          leadership_position_id: positionId,
          start_date: startDate || null,
          end_date: endDate || null,
        }));
      }

      if (error) throw error;
      toast.success("Assigned successfully.");
      await reloadData();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign.");
    } finally {
      setSubmitting(false);
    }
  };

  const memberDisplay = (m: Member) =>
    `${m.last_name ?? ""}, ${m.first_name ?? ""}`;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-white/50 transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed right-0 bottom-0 z-50 h-[90%] w-1/3 transform rounded-tl-xl border bg-white shadow-lg ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } transition-transform duration-250`}
      >
        <div className="flex h-full flex-col">
          <div className="flex flex-col border-b p-4">
            <div className="flex justify-between">
              <div className="text-medium inline-block max-w-fit rounded-3xl bg-[#C9FFAE] px-4 py-1 italic">
                <span className="font-semibold">assigning </span>
                <span className="font-light">new row to </span>
                <span className="font-semibold">
                  {TABLE_LABELS[table] ?? table}
                </span>
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
            ref={scrollRef}
            className="custom-scrollbar flex h-full w-full flex-col gap-8 overflow-hidden overflow-y-auto p-8"
          >
            {!lookupLoaded ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <label className="font-medium capitalize">Member</label>
                  <Combobox
                    items={members}
                    value={memberId}
                    onSelect={setMemberId}
                    placeholder="Select a member..."
                    searchPlaceholder="Search members..."
                    displayFn={memberDisplay}
                  />
                </div>

                {table === "committee_members" && (
                  <>
                    <div className="flex flex-col gap-2">
                      <label className="font-medium capitalize">
                        Committee
                      </label>
                      <Combobox
                        items={committees}
                        value={committeeId}
                        onSelect={setCommitteeId}
                        placeholder="Select a committee..."
                        searchPlaceholder="Search committees..."
                        displayFn={(c) => c.committee_name ?? "(unnamed)"}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="font-medium capitalize">
                        Position{" "}
                        <span className="font-normal text-gray-400">
                          (optional)
                        </span>
                      </label>
                      <input
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        placeholder="e.g. Chair, Member"
                        className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="assign-active"
                        checked={active}
                        onChange={(e) => setActive(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <label
                        htmlFor="assign-active"
                        className="text-sm font-medium"
                      >
                        Active
                      </label>
                    </div>
                  </>
                )}

                {table === "sdg_members" && (
                  <div className="flex flex-col gap-2">
                    <label className="font-medium capitalize">SDG</label>
                    <Combobox
                      items={sdgs}
                      value={sdgId}
                      onSelect={setSdgId}
                      placeholder="Select an SDG..."
                      searchPlaceholder="Search SDGs..."
                      displayFn={(s) =>
                        `${s.sdg ?? ""} (${s.trimester ?? ""})`
                      }
                    />
                  </div>
                )}

                {table === "leadership" && (
                  <>
                    <div className="flex flex-col gap-2">
                      <label className="font-medium capitalize">
                        Leadership Position
                      </label>
                      <Combobox
                        items={positions}
                        value={positionId}
                        onSelect={setPositionId}
                        placeholder="Select a position..."
                        searchPlaceholder="Search positions..."
                        displayFn={(p) =>
                          p.leadership_position ?? "(unnamed)"
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="font-medium capitalize">
                        Start Date{" "}
                        <span className="font-normal text-gray-400">
                          (optional)
                        </span>
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="font-medium capitalize">
                        End Date{" "}
                        <span className="font-normal text-gray-400">
                          (optional)
                        </span>
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                      />
                    </div>
                  </>
                )}

                <div className="flex w-full justify-start gap-2">
                  <button
                    className="text-medium inline-block max-h-fit max-w-fit cursor-pointer items-center justify-center rounded-lg bg-gray-100 px-3 py-1"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    className="text-medium inline-block max-h-fit max-w-fit cursor-pointer items-center justify-center rounded-lg bg-[#C9FFAE] px-3 py-1 font-semibold"
                    onClick={handleSave}
                    disabled={submitting}
                  >
                    {submitting ? "Saving..." : "Save"}
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
