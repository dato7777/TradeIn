import Link from "next/link";

const downloadClass =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white " +
  "bg-gradient-to-b from-blue-500 to-blue-700 " +
  "shadow-[0_4px_16px_rgba(59,130,246,0.5),inset_0_1px_0_rgba(255,255,255,0.2)] " +
  "hover:from-blue-400 hover:to-blue-600 hover:shadow-[0_6px_20px_rgba(59,130,246,0.55)] " +
  "active:translate-y-px transition-all";

const uploadClass =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white " +
  "bg-gradient-to-b from-emerald-500 to-emerald-700 " +
  "shadow-[0_4px_16px_rgba(16,185,129,0.45),inset_0_1px_0_rgba(255,255,255,0.2)] " +
  "hover:from-emerald-400 hover:to-emerald-600 hover:shadow-[0_6px_20px_rgba(16,185,129,0.5)] " +
  "active:translate-y-px transition-all";

interface Props {
  onDownload: () => void;
  showUpload?: boolean;
}

export function ExcelActionButtons({ onDownload, showUpload = false }: Props) {
  return (
    <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2 sm:gap-3">
      {showUpload && (
        <Link href="/admin/upload" className={`w-full sm:w-auto ${uploadClass}`}>
          Upload Excel
        </Link>
      )}
      <button type="button" onClick={onDownload} className={`w-full sm:w-auto ${downloadClass}`}>
        Download Excel
      </button>
    </div>
  );
}

export function DownloadExcelButton({
  onClick,
  className = "",
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button type="button" onClick={onClick} className={`${downloadClass} ${className}`}>
      Download Excel
    </button>
  );
}
