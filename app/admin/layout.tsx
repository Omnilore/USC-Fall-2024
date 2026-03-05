"use client";

import { useLoginRedirect } from "@/hooks/use-login-redirect";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import Logo from "@/components/assets/logo.png";
import { LogOut, MailIcon } from "lucide-react";
import { getDocumentationLink, signOut } from "@/app/supabase";
import { getRoles } from "@/app/supabase";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useLoginRedirect();
  const router = useRouter();
  const pathname = usePathname();
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState<string>("");
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    const setup = async () => {
      try {
        const userRoles = await getRoles();
        if (!userRoles) {
          console.error("Failed to fetch roles");
          return;
        }
        if (userRoles.includes("member") || userRoles.length === 0) {
          router.push("/members");
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
    if (typeof window !== "undefined") {
      const storedTab = localStorage.getItem("activeReportTab");
      if (storedTab && pathname === "/admin/reports")
        setActiveReportTab(storedTab);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("activeReportTab", activeReportTab);
    }
  }, [activeReportTab]);

  const handleReportTabClick = (tab: string) => {
    setActiveReportTab(tab);
    setShowSubMenu(true);
    // Convert "Ad-Hoc" to "adhoc" for the route
    const route = tab === "Ad-Hoc" ? "adhoc" : tab.toLowerCase();
    router.push(`/admin/reports/${route}`);
  };

  useEffect(() => {
    router.prefetch("/admin/tables");
    router.prefetch("/admin/reports");
    router.prefetch("/admin/reports/audit");
    router.prefetch("/admin/conflicts");
  }, [router]);

  const handleOtherTabClick = (path: string) => {
    setActiveReportTab("");
    setShowSubMenu(false);
    router.push(path);
  };

  return (
    <div className="flex h-screen w-full flex-col bg-gray-100">
      <div className="flex w-full grow flex-row items-center justify-center overflow-y-auto">
        <div className="relative flex h-full w-1/6 flex-col gap-4 rounded-xl bg-white p-4">
          <div className="flex flex-row items-center gap-3">
            <img src={Logo.src} className="h-fit w-12" alt="Omnilore Logo" />
            <div>
              <div className="text-xl font-bold">Omnilore</div>
              <div className="text-xs">Learning-in-Retirement, Inc</div>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div onClick={() => handleOtherTabClick("/admin/tables")}>
              {" "}
              <TableButton />{" "}
            </div>
            <div
              onMouseEnter={() => setShowSubMenu(true)}
              onMouseLeave={() => setShowSubMenu(activeReportTab !== "")}
              className="relative"
            >
              <ReportsButton />
              {(showSubMenu || activeReportTab !== "") && (
                <div className="flex flex-col gap-1 pl-6">
                  {["Membership", "Forum", "Donation", "Financial", "Transactions", "Ad-Hoc", "Audit"].map(
                    (tab) => (
                      <button
                        key={tab}
                        onClick={() => handleReportTabClick(tab)}
                        className={`group flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 ${activeReportTab === tab ? "bg-[#F6F6F6] text-[#000000]" : "bg-white text-[#85849E]"} hover:bg-[#F6F6F6]`}
                      >
                        <span
                          className={`group-hover:text-[#000000] ${activeReportTab === tab ? "text-[#000000]" : "text-[#85849E]"}`}
                        >
                          {tab}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
            <div
              className="cursor-pointer"
              onClick={() => handleOtherTabClick("/admin/conflicts")}
            >
              {" "}
              <ConflictsButton />{" "}
            </div>
            <div onClick={() => handleOtherTabClick("/admin/mail-in")}>
              {" "}
              <MailInButton />{" "}
            </div>
            <a
              href="https://omnilore-ecart.squarespace.com/membership"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-[#85849E] hover:bg-[#F6F6F6]"
            >
              <span className="text-left group-hover:text-[#000000]">
                Membership (Join/Renew)
              </span>
            </a>
          </div>

          {/* Spacer to push logout to bottom */}
          <div className="flex-grow"></div>

          <div className="w-full rounded-md bg-gradient-to-r from-gray-100 to-gray-200 px-3 py-2 text-center text-[11px] font-medium tracking-wide text-gray-600">
            {roles}
          </div>

          {/* Logout button positioned at bottom */}
          <div className="flex flex-col items-start justify-center border-t border-gray-100 pt-2">
            <button
              onClick={async () => {
                const link = await getDocumentationLink();
                window.open(link, "_blank");
              }}
              className="group flex w-full cursor-pointer items-center gap-2 p-2 text-[#85849E]"
            >
              <HelpIcon className="group-hover:bg-blue-500" />
              <span className="text-left group-hover:text-blue-500">Help</span>
            </button>
            <button
              onClick={async () => {
                await signOut();
                router.push("/login");
              }}
              className="group flex w-full cursor-pointer items-center gap-2 p-2 text-[#85849E]"
            >
              <LogOut className="group-hover:stroke-red-500" size={20} />
              <span className="text-left group-hover:text-red-500">Logout</span>
            </button>
          </div>
        </div>

        {/* Page content */}
        <div className="flex h-full w-5/6 flex-col overflow-auto rounded-xl bg-white">
          {children}
        </div>
      </div>
    </div>
  );
}

const TableButton = () => {
  const router = useRouter();
  const pathname = usePathname();
  const isActive = pathname === "/admin/tables";

  const TableIcon = () => (
    <svg
      width="25"
      height="28"
      viewBox="0 0 25 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`group-hover:stroke-[#000000] ${isActive ? "stroke-[#000000]" : "stroke-[#85849E]"}`}
    >
      <path
        d="M24 9.63025V4C24 2.34315 22.6569 1 21 1H4C2.34315 1 1 2.34315 1 4V9.63025M24 9.63025H1M24 9.63025V18.3151M1 9.63025V18.3151M24 18.3151V24C24 25.6569 22.6569 27 21 27H4C2.34315 27 1 25.6569 1 24V18.3151M24 18.3151H1"
        strokeWidth="2"
      />
    </svg>
  );

  return (
    <button
      className={`group flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 ${
        isActive ? "bg-[#F6F6F6]" : "bg-white"
      } hover:bg-[#F6F6F6]`}
    >
      <TableIcon />
      <span
        className={`group-hover:text-[#000000] ${isActive ? "text-[#000000]" : "text-[#85849E]"}`}
      >
        Table
      </span>
    </button>
  );
};

const ReportsButton = () => {
  const router = useRouter();
  const pathname = usePathname();
  const isActive = pathname === "/admin/reports";

  const ReportsIcon = () => (
    <svg
      width="25"
      height="29"
      viewBox="0 0 25 29"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`group-hover:stroke-[#000000] ${isActive ? "stroke-[#000000]" : "stroke-[#85849E]"}`}
    >
      <path
        d="M14.9266 1H4C2.34315 1 1 2.34315 1 4V25C1 26.6569 2.34315 28 4 28H21C22.6569 28 24 26.6569 24 25V9.41304M14.9266 1L24 9.41304M14.9266 1V8.41304C14.9266 8.96533 15.3743 9.41304 15.9266 9.41304H24M6.27523 20.5652L10.775 15.85L14.225 19.225L18.825 13.825"
        strokeWidth="2"
      />
    </svg>
  );

  return (
    <button
      className={`group flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 ${
        isActive ? "bg-[#F6F6F6]" : "bg-white"
      } hover:bg-[#F6F6F6]`}
    >
      <ReportsIcon />
      <span
        className={`group-hover:text-[#000000] ${isActive ? "text-[#000000]" : "text-[#85849E]"}`}
      >
        Reports
      </span>
    </button>
  );
};

const ConflictsButton = () => {
  const router = useRouter();
  const pathname = usePathname();
  const isActive = pathname === "/admin/conflicts";

  const ConflictsIcon = () => (
    <svg
      width="25"
      height="24"
      viewBox="0 0 25 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`group-hover:stroke-[#000000] ${isActive ? "stroke-[#000000]" : "stroke-[#85849E]"}`}
    >
      <path
        d="M1 6.8149C1 6.74074 1 5.66568 1 4.42032C1 2.76347 2.34315 1.41992 4 1.41992H6.03531"
        strokeWidth="2"
      />
      <path
        d="M17.3648 1.41992C17.4611 1.41992 19.0049 1.41992 20.6587 1.41992C22.3156 1.41992 23.6589 2.76307 23.6589 4.41992V6.8149"
        strokeWidth="2"
      />
      <path
        d="M1 17.605C1 17.6792 1 18.7542 1 19.9996C1 21.6565 2.34315 23 4 23H6.03531"
        strokeWidth="2"
      />
      <path
        d="M17.3648 23C17.4611 23 19.0049 23 20.6587 23C22.3156 23 23.6589 21.6569 23.6589 20V17.605"
        strokeWidth="2"
      />
      <path
        d="M6.15653 6.81445L9.8118 12.167M9.8118 12.167H1M9.8118 12.167L6.15653 17.6044"
        strokeWidth="2"
      />
      <path
        d="M18.5024 6.81445L14.8471 12.167M14.8471 12.167H23.6589M14.8471 12.167L18.5024 17.6044"
        strokeWidth="2"
      />
    </svg>
  );

  return (
    <button
      onClick={() => router.push("/admin/conflicts")}
      className={`group flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 ${
        isActive ? "bg-[#F6F6F6]" : "bg-white"
      } hover:bg-[#F6F6F6]`}
    >
      <ConflictsIcon />
      <span
        className={`text-left group-hover:text-[#000000] ${isActive ? "text-[#000000]" : "text-[#85849E]"}`}
      >
        Member Conflicts
      </span>
    </button>
  );
};

const MailInButton = () => {
  const router = useRouter();
  const pathname = usePathname();
  const isActive = pathname === "/admin/mail-in";

  const MailInIcon = () => (
    <MailIcon
      className={`group-hover:stroke-[#000000] ${isActive ? "stroke-[#000000]" : "stroke-[#85849E]"}`}
    />
  );

  return (
    <button
      onClick={() => router.push("/admin/mail-in")}
      className={`group flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 ${
        isActive ? "bg-[#F6F6F6]" : "bg-white"
      } hover:bg-[#F6F6F6]`}
    >
      <MailInIcon />
      <span
        className={`text-left group-hover:text-[#000000] ${isActive ? "text-[#000000]" : "text-[#85849E]"}`}
      >
        Add Mail-In Order
      </span>
    </button>
  );
};

const HelpIcon = ({
  className,
  size = 20,
}: {
  className?: string;
  size?: number;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8.3335 7.50065C8.3335 7.01151 8.51594 6.69868 8.75546 6.49545C9.01309 6.27685 9.3863 6.14648 9.79183 6.14648C10.1974 6.14648 10.5706 6.27685 10.8282 6.49545C11.0677 6.69868 11.2502 7.01151 11.2502 7.50065C11.2502 7.86496 11.1643 8.06721 11.0646 8.21679C10.9483 8.3913 10.7952 8.52891 10.5363 8.76163L10.4844 8.80832C10.218 9.04802 9.86764 9.37207 9.60047 9.84406C9.32514 10.3305 9.16683 10.9182 9.16683 11.6673C9.16683 12.1276 9.53993 12.5007 10.0002 12.5007C10.4604 12.5007 10.8335 12.1276 10.8335 11.6673C10.8335 11.1664 10.9356 10.8687 11.0509 10.6651C11.1744 10.4469 11.3448 10.2762 11.5993 10.0471C11.6222 10.0265 11.6464 10.005 11.6715 9.98255C11.8993 9.77957 12.2112 9.50152 12.4514 9.14129C12.7423 8.70493 12.9168 8.17801 12.9168 7.50065C12.9168 6.53146 12.5264 5.75054 11.9065 5.2246C11.3048 4.71403 10.5321 4.47982 9.79183 4.47982C9.05153 4.47982 8.2789 4.71403 7.67716 5.2246C7.0573 5.75054 6.66683 6.53146 6.66683 7.50065C6.66683 7.96089 7.03993 8.33398 7.50016 8.33398C7.9604 8.33398 8.3335 7.96089 8.3335 7.50065Z"
      className="fill-[#757575] group-hover:fill-blue-500"
    />
    <path
      d="M10.6251 15.5604C10.9347 15.2199 10.9096 14.6928 10.5691 14.3832C10.2285 14.0736 9.70149 14.0987 9.39189 14.4392L9.38356 14.4484C9.07396 14.7889 9.09905 15.316 9.43959 15.6256C9.78013 15.9352 10.3072 15.9101 10.6168 15.5696L10.6251 15.5604Z"
      className="fill-[#757575] group-hover:fill-blue-500"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.0002 0.833984C4.93743 0.833984 0.833496 4.93791 0.833496 10.0007C0.833496 15.0634 4.93743 19.1673 10.0002 19.1673C15.0629 19.1673 19.1668 15.0634 19.1668 10.0007C19.1668 4.93791 15.0629 0.833984 10.0002 0.833984ZM2.50016 10.0007C2.50016 5.85839 5.8579 2.50065 10.0002 2.50065C14.1424 2.50065 17.5002 5.85839 17.5002 10.0007C17.5002 14.1429 14.1424 17.5007 10.0002 17.5007C5.8579 17.5007 2.50016 14.1429 2.50016 10.0007Z"
      className="fill-[#757575] group-hover:fill-blue-500"
    />
  </svg>
);
