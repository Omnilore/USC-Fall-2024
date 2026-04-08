import { useRef } from "react";
import { Copy } from "lucide-react";
import UserIcon from "@/components/assets/user-icon.png";

interface MemberPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRow: {
    id: number;
    Name: string;
    Address: string;
    "Phone Number": string;
    Email: string;
    Photo?: string;
  } | null;
}

export default function MemberPanel({
  isOpen,
  onClose,
  selectedRow,
}: MemberPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const FieldWithCopy = ({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) => (
    <div className="flex items-start gap-2">
      <span className="font-semibold">{label}:</span>
      <span>{value}</span>
      <button
        className="mt-1 text-gray-300 hover:text-gray-500"
        onClick={() => copyToClipboard(value)}
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-white/50" onClick={onClose} />
      )}

      <div
        className={`fixed right-0 bottom-0 z-50 h-[90%] w-1/4 transform rounded-tl-xl border bg-white shadow-lg ${isOpen ? "translate-x-0" : "translate-x-full"} transition-transform duration-250`}
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-xl font-semibold">Member Details</h2>
            <button className="text-xl text-[#616161]" onClick={onClose}>
              ✖
            </button>
          </div>

          <div
            ref={scrollContainerRef}
            className="custom-scrollbar grow overflow-y-auto px-6 py-8"
          >
            {selectedRow ? (
              <div className="text-medium space-y-4 text-[#616161]">
                {selectedRow?.Photo && (
                  <div className="mb-4 flex justify-center">
                    <img
                      src={selectedRow.Photo}
                      alt="Member Photo"
                      className="h-24 w-24 rounded-full object-cover shadow-sm"
                      onError={(e) => {
                        e.currentTarget.src = UserIcon.src;
                      }}
                    />
                  </div>
                )}
                <FieldWithCopy label="Name" value={selectedRow.Name} />
                <FieldWithCopy label="Address" value={selectedRow.Address} />
                <FieldWithCopy
                  label="Phone Number"
                  value={selectedRow["Phone Number"]}
                />
                <FieldWithCopy label="Email" value={selectedRow.Email} />
              </div>
            ) : (
              <div>No member selected.</div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t p-4">
            <button
              className="rounded-lg bg-gray-200 px-4 py-2"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
