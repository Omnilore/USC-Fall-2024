"use client";
import { useState, useEffect, useMemo } from "react";
import { getRoles, signOut } from "@/app/supabase";
import UserIcon from "@/components/assets/user-icon.png";
import { queryTableWithFields } from "@/app/queryFunctions";
import NavBar from "@/components/ui/NavBar";
import TableComponent from "@/components/ui/TableComponent";
import MemberPanel from "@/components/ui/MemberPanel";
import { FormattedKeysMember } from "@/app/types";
import { useLoginRedirect } from "@/hooks/use-login-redirect";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const memberSchema = {
  id: { type: "basic", name: "int", nullable: false },
  first_name: { type: "basic", name: "text", nullable: true },
  last_name: { type: "basic", name: "text", nullable: true },
  alias: { type: "basic", name: "text", nullable: true },
  street_address: { type: "basic", name: "text", nullable: true },
  city: { type: "basic", name: "text", nullable: true },
  state: { type: "basic", name: "text", nullable: true },
  zip_code: { type: "basic", name: "text", nullable: true },
  phone: { type: "basic", name: "text", nullable: true },
  email: { type: "basic", name: "text", nullable: true },
  photo_link: { type: "basic", name: "text", nullable: true },
  public: { type: "basic", name: "boolean", nullable: true },
  type: { type: "basic", name: "text", nullable: true }
};

export default function Search() {
  useLoginRedirect();
  const [query, setQuery] = useState("");
  const router = useRouter();
  const [entries, setEntries] = useState<Record<string, any>[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>("members");
  const [primaryKey, setPrimaryKey] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<FormattedKeysMember | null>(
    null,
  );
  const [isMemberPanelOpen, setIsMemberPanelOpen] = useState(false);

  const filteredEntries = useMemo(() => {
    const keywords = query.toLowerCase().split(" ").filter(Boolean);
    return entries
      .filter(item => item.public !== false && item.type !== "NONMEMBER")
      .filter(item =>
        keywords.every(kw =>
          Object.values(item).some(
            value =>
              value !== null && value.toString().toLowerCase().includes(kw),
          ),
        ),
      );
  }, [query, entries]);
  

  useEffect(() => {
    const setup = async () => {
      try {
        const userRoles = await getRoles();
        if (!userRoles) {
          console.error("Failed to fetch roles");
          return;
        }
        setRoles(userRoles);
      } catch (error) {
        console.error("Error fetching roles:", error);
      }
    };

    setup();
  }, []);

  useEffect(() => {
    const setup = async () => {
      const roles = await getRoles();
      if (!roles) {
        console.error("Failed to fetch roles");
        return;
      }
      setRoles(roles);
      console.log("Roles", roles);

      setSelectedTable("members");
    };
    setup().catch(console.error);
  }, []);

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        const { data, primaryKey } = await queryTableWithFields(
          "members",
          memberSchema,
        );
        setEntries(data);
        setPrimaryKey(primaryKey);
      } catch (error: any) {
        console.error(`Failed to fetch data for members table`, error);
        if (error?.message) {
          console.error("Error message:", error.message);
        }
        if (error?.status) {
          console.error("HTTP Status:", error.status);
        }
      }
    };

    fetchEntries();
  }, [selectedTable]);

  useEffect(() => {
    console.log("Selected Row:", selectedRow);
  }, [selectedRow]);

  const formattedData = useMemo(() => {
    return filteredEntries.map((member) => {
      const name = `${member.first_name || ""}${
        member.alias && member.alias.trim() ? ` (${member.alias})` : ""
      } ${member.last_name || ""}`.trim();
      const addressParts = [
        member.street_address,
        member.city,
        member.state,
        member.zip_code,
      ].filter(Boolean);
      return {
        Photo: member.photo_link || UserIcon.src,
        Name: name,
        Address: addressParts.join(", "),
        "Phone Number": member.phone || "",
        Email: member.email || "",
        id: member.id,
      };
    });
  }, [filteredEntries]);

  return (
    <div className="flex h-screen w-full flex-col">
      <div className="flex items-center">
        {/* Nav Bar */}
        <NavBar />
        {/* Logout button */}
        <button
          onClick={async () => {
            await signOut();
            router.push("/login");
          }}
          className="group flex w-full items-center justify-end gap-2 p-2 pr-12 text-[#85849E]"
        >
          <LogOut className="group-hover:stroke-red-500" size={20} />
          <span className="text-left group-hover:text-red-500">Logout</span>
        </button>
      </div>

      <div className="flex w-full grow flex-col overflow-y-auto">
        {roles === null ? (
          <div>Loading...</div>
        ) : (
          <div className="flex h-full w-full flex-col items-center">
            <div className="flex h-full w-5/6 flex-col gap-3">
              <h1 className="text-3xl font-semibold">Members</h1>
              <p className="text-base text-gray-600">
                Connect with Omnilore Members
              </p>
              <div className="relative mt-4 w-full">
                <img
                  src="/search-icon.svg"
                  alt="Search Icon"
                  className="absolute top-1/2 left-5 h-5 w-5 -translate-y-1/2 transform"
                />

                <input
                  type="text"
                  placeholder="Search by name or nickname..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-md border border-gray-300 py-4 pr-2 pl-12 text-gray-700 focus:border-gray-500 focus:ring-1 focus:ring-gray-300 focus:outline-hidden"
                />
              </div>
              <div className="mb-4 w-full grow overflow-y-auto">
                <TableComponent
                  entries={formattedData}
                  roles={roles}
                  selectedRow={selectedRow}
                  handleRowSelection={(row: Record<string, any>) => {
                    setSelectedRow(row as FormattedKeysMember);
                    setIsMemberPanelOpen(true);
                  }}
                  primaryKeys={["id"]}
                  showImages={true}
                  adminTable={false}
                />
              </div>
              {selectedRow && (
                <MemberPanel
                  isOpen={isMemberPanelOpen}
                  onClose={() => setIsMemberPanelOpen(false)}
                  selectedRow={selectedRow}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={membershipModalOpen} onOpenChange={setMembershipModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Who is this for?</DialogTitle>
            <DialogDescription>
              Search for a member to pre-fill the membership form, or continue
              manually to fill it out yourself.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <input
              type="text"
              placeholder="Search by name or nickname..."
              value={memberSearchQuery}
              onChange={(e) => {
                setMemberSearchQuery(e.target.value);
                setSelectedMemberForMembership(null);
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:ring-1 focus:ring-gray-300 focus:outline-none"
            />
            {memberSearchQuery.trim() && (
              <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-gray-50">
                {membershipSearchMatches.length === 0 ? (
                  <p className="p-3 text-sm text-gray-500">
                    No matching members found.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {membershipSearchMatches.map((m) => {
                      const name = `${m.first_name || ""}${m.alias && m.alias.trim() ? ` (${m.alias})` : ""} ${m.last_name || ""}`.trim();
                      const isSelected =
                        selectedMemberForMembership?.id === m.id;
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedMemberForMembership(
                                isSelected ? null : m,
                              )
                            }
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${isSelected ? "bg-blue-50 font-medium text-blue-800" : "text-gray-700"}`}
                          >
                            {name}
                            {m.email && (
                              <span className="ml-1 text-gray-500">
                                — {m.email}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex flex-row flex-wrap gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => openMembershipWithMember(null)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Continue manually
            </button>
            <button
              type="button"
              onClick={() =>
                openMembershipWithMember(selectedMemberForMembership)
              }
              disabled={!selectedMemberForMembership}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none"
            >
              Continue with selected member
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
