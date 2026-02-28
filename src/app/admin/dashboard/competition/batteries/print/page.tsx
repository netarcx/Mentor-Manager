"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";

interface Battery {
  id: number;
  label: string;
  active: boolean;
  retired: boolean;
}

export default function BatteryPrintPage() {
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/competition/batteries")
      .then((r) => r.json())
      .then((data) => {
        setBatteries(
          (data.batteries || []).filter((b: Battery) => b.active && !b.retired)
        );
        setLoading(false);
      });
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  if (loading) {
    return (
      <div className="p-8 text-slate-500">Loading batteries...</div>
    );
  }

  if (batteries.length === 0) {
    return (
      <div className="p-8 text-slate-500">No active batteries to print.</div>
    );
  }

  return (
    <div className="p-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .qr-card {
            page-break-after: always;
            border: 3px solid #000 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            height: 100vh;
            padding: 0 !important;
            margin: 0 !important;
            border-radius: 0 !important;
          }
          .qr-card:last-child { page-break-after: auto; }
        }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Battery QR Labels</h1>
        <button
          onClick={() => window.print()}
          className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm"
        >
          Print
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 print:block">
        {batteries.map((battery) => (
          <div
            key={battery.id}
            className="qr-card border-2 border-slate-200 rounded-xl p-6 flex flex-col items-center gap-4"
          >
            <QRCodeSVG
              value={`${origin}/battery/${battery.id}`}
              size={180}
              level="M"
              className="print:!w-[300px] print:!h-[300px]"
            />
            <div className="text-center">
              <div className="text-2xl font-bold print:text-4xl">{battery.label}</div>
              <div className="text-xs text-slate-400 mt-1 print:text-lg print:text-black print:mt-3">
                Scan to update status
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
