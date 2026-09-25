import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

export function EmergencyFAB() {
  return (
    <Link
      to="/emergency"
      title="Dental emergency? Get urgent help"
      aria-label="Emergency dental care"
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-3 z-50 flex min-h-[44px] items-center gap-2 rounded-full bg-red-600 px-4 py-3 text-white shadow-lg shadow-red-600/40 transition-colors hover:bg-red-500 motion-reduce:animate-none sm:right-4 md:bottom-6"
    >
      <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="hidden text-sm font-semibold sm:inline">Emergency</span>
    </Link>
  );
}

export const EmergencyFab = EmergencyFAB;
