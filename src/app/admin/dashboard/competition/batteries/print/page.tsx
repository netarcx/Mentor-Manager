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

  // Configurable label settings
  const [stickerSize, setStickerSize] = useState(2); // inches
  const [qrScale, setQrScale] = useState(70); // % of sticker width
  const [textSize, setTextSize] = useState(14); // pt

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

  // Derived values
  const qrPrintSize = stickerSize * (qrScale / 100); // inches
  const qrScreenSize = Math.round(96 * qrPrintSize); // px at 96dpi for screen preview

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
    <div className="p-8 print:p-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .qr-grid {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 0 !important;
            padding: 0.25in !important;
          }
          .qr-card {
            width: ${stickerSize}in !important;
            height: ${stickerSize}in !important;
            padding: 0.1in !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            page-break-inside: avoid;
          }
          .qr-card svg {
            width: ${qrPrintSize}in !important;
            height: ${qrPrintSize}in !important;
          }
          .qr-label {
            font-size: ${textSize}pt !important;
          }
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

      {/* Settings panel */}
      <div className="no-print bg-white rounded-xl shadow border border-slate-100 p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Label Settings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-sm font-medium mb-1">
              Sticker Size: {stickerSize}&Prime; &times; {stickerSize}&Prime;
            </label>
            <input
              type="range"
              value={stickerSize}
              onChange={(e) => setStickerSize(Number(e.target.value))}
              min={1}
              max={4}
              step={0.25}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-0.5">
              <span>1&Prime;</span>
              <span>4&Prime;</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              QR Code: {qrScale}% of sticker
            </label>
            <input
              type="range"
              value={qrScale}
              onChange={(e) => setQrScale(Number(e.target.value))}
              min={40}
              max={90}
              step={5}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-0.5">
              <span>40%</span>
              <span>90%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Text Size: {textSize}pt
            </label>
            <input
              type="range"
              value={textSize}
              onChange={(e) => setTextSize(Number(e.target.value))}
              min={8}
              max={24}
              step={1}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-0.5">
              <span>8pt</span>
              <span>24pt</span>
            </div>
          </div>
        </div>
      </div>

      <div className="qr-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {batteries.map((battery) => (
          <div
            key={battery.id}
            className="qr-card flex flex-col items-center justify-center gap-1.5 p-4"
            style={{ width: `${stickerSize}in`, height: `${stickerSize}in` }}
          >
            <QRCodeSVG
              value={`${origin}/battery/${battery.id}`}
              size={qrScreenSize}
              level="M"
            />
            <div
              className="qr-label font-bold leading-tight text-center"
              style={{ fontSize: `${textSize}pt` }}
            >
              {battery.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
