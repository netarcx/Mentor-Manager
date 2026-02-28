"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";

interface Battery {
  id: number;
  label: string;
  active: boolean;
  retired: boolean;
}

interface Preset {
  label: string;
  width: number;
  height: number;
  qrScale: number;
  textSize: number;
}

const PRESETS: Preset[] = [
  { label: '2" x 2"', width: 2, height: 2, qrScale: 70, textSize: 14 },
  { label: '2" x 2\u2075\u2044\u2081\u2086"', width: 2, height: 2.3125, qrScale: 65, textSize: 14 },
];

function formatDim(v: number): string {
  const whole = Math.floor(v);
  const frac = v - whole;
  if (frac === 0) return `${whole}`;
  // common fractions
  const fracs: [number, string][] = [
    [0.0625, "\u00B9\u2044\u2081\u2086"],
    [0.125, "\u00B9\u2044\u2088"],
    [0.1875, "\u00B3\u2044\u2081\u2086"],
    [0.25, "\u00BC"],
    [0.3125, "\u2075\u2044\u2081\u2086"],
    [0.375, "\u00B3\u2044\u2088"],
    [0.4375, "\u2077\u2044\u2081\u2086"],
    [0.5, "\u00BD"],
    [0.5625, "\u2079\u2044\u2081\u2086"],
    [0.625, "\u2075\u2044\u2088"],
    [0.6875, "\u00B9\u00B9\u2044\u2081\u2086"],
    [0.75, "\u00BE"],
    [0.8125, "\u00B9\u00B3\u2044\u2081\u2086"],
    [0.875, "\u2077\u2044\u2088"],
    [0.9375, "\u00B9\u2075\u2044\u2081\u2086"],
  ];
  for (const [f, s] of fracs) {
    if (Math.abs(frac - f) < 0.001) return whole > 0 ? `${whole}${s}` : s;
  }
  return v.toFixed(2);
}

export default function BatteryPrintPage() {
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [loading, setLoading] = useState(true);

  // Configurable label settings
  const [stickerWidth, setStickerWidth] = useState(2);
  const [stickerHeight, setStickerHeight] = useState(2);
  const [qrScale, setQrScale] = useState(70);
  const [textSize, setTextSize] = useState(14);

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

  // QR code sized relative to the smaller dimension so it always fits
  const minDim = Math.min(stickerWidth, stickerHeight);
  const qrPrintSize = minDim * (qrScale / 100);
  const qrScreenSize = Math.round(96 * qrPrintSize);

  function applyPreset(p: Preset) {
    setStickerWidth(p.width);
    setStickerHeight(p.height);
    setQrScale(p.qrScale);
    setTextSize(p.textSize);
  }

  const activePreset = PRESETS.find(
    (p) => p.width === stickerWidth && p.height === stickerHeight && p.qrScale === qrScale && p.textSize === textSize
  );

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
            box-sizing: border-box !important;
            width: ${stickerWidth}in !important;
            height: ${stickerHeight}in !important;
            padding: 0.1in !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            page-break-inside: avoid;
            overflow: hidden !important;
          }
          .qr-card svg {
            display: block !important;
            width: ${qrPrintSize}in !important;
            height: ${qrPrintSize}in !important;
            flex-shrink: 0 !important;
          }
          .qr-label {
            font-size: ${textSize}pt !important;
            text-align: center !important;
            width: 100% !important;
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Label Settings</h2>
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  activePreset === p
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          <div>
            <label className="block text-sm font-medium mb-1">
              Width: {formatDim(stickerWidth)}&Prime;
            </label>
            <input
              type="range"
              value={stickerWidth}
              onChange={(e) => setStickerWidth(Number(e.target.value))}
              min={1}
              max={4}
              step={0.0625}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-0.5">
              <span>1&Prime;</span>
              <span>4&Prime;</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Height: {formatDim(stickerHeight)}&Prime;
            </label>
            <input
              type="range"
              value={stickerHeight}
              onChange={(e) => setStickerHeight(Number(e.target.value))}
              min={1}
              max={4}
              step={0.0625}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-0.5">
              <span>1&Prime;</span>
              <span>4&Prime;</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              QR Code: {qrScale}%
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
              Text: {textSize}pt
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
            className="qr-card flex flex-col items-center justify-center gap-1.5 p-4 overflow-hidden"
            style={{ width: `${stickerWidth}in`, height: `${stickerHeight}in`, boxSizing: "border-box" }}
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
