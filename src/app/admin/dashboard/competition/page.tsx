"use client";

import { useState, useEffect } from "react";

interface ChecklistItem {
  id: number;
  text: string;
  active: boolean;
  sortOrder: number;
}

interface BatteryItem {
  id: number;
  label: string;
  sortOrder: number;
  active: boolean;
  retired: boolean;
  cycleCount: number;
  lastVoltage: number | null;
  currentStatus: string | null;
  statusSince: string | null;
}

interface MatchAuditEntry {
  matchKey: string;
  batteries: {
    label: string;
    status: string;
    voltage: number | null;
    note: string;
    createdAt: string;
  }[];
}

export default function CompetitionPage() {
  // TBA config state
  const [enabled, setEnabled] = useState(false);
  const [tbaApiKey, setTbaApiKey] = useState("");
  const [teamKey, setTeamKey] = useState("");
  const [eventKey, setEventKey] = useState("");
  const [pollInterval, setPollInterval] = useState(60);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [pitTimerEnabled, setPitTimerEnabled] = useState(false);
  const [exampleMode, setExampleMode] = useState(false);
  const [twitchChannel, setTwitchChannel] = useState("");
  const [twitchPopupSize, setTwitchPopupSize] = useState(30);
  const [robotImageSource, setRobotImageSource] = useState<"none" | "tba" | "upload">("none");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState("Save");
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  // Checklist state
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formText, setFormText] = useState("");
  const [loading, setLoading] = useState(true);

  // Battery state
  const [batteries, setBatteries] = useState<BatteryItem[]>([]);
  const [batteryShowForm, setBatteryShowForm] = useState(false);
  const [batteryEditingId, setBatteryEditingId] = useState<number | null>(null);
  const [batteryFormLabel, setBatteryFormLabel] = useState("");
  const [resetting, setResetting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDays, setHistoryDays] = useState<
    {
      date: string;
      totalChanges: number;
      batteries: { label: string; changes: number; matches: number }[];
    }[]
  >([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [matchAuditOpen, setMatchAuditOpen] = useState(false);
  const [matchAuditData, setMatchAuditData] = useState<MatchAuditEntry[]>([]);
  const [matchAuditLoaded, setMatchAuditLoaded] = useState(false);

  async function fetchConfig() {
    const res = await fetch("/api/admin/settings/competition");
    const data = await res.json();
    setEnabled(data.enabled ?? false);
    setTeamKey((data.teamKey ?? "").replace(/^frc/, ""));
    setEventKey(data.eventKey ?? "");
    setPollInterval(data.pollInterval ?? 60);
    setHasApiKey(data.hasApiKey ?? false);
    setRobotImageSource(data.robotImageSource ?? "none");
    setPitTimerEnabled(data.pitTimerEnabled ?? false);
    setExampleMode(data.exampleMode ?? false);
    setTwitchChannel(data.twitchChannel ?? "");
    setTwitchPopupSize(data.twitchPopupSize ?? 30);
  }

  async function fetchChecklist() {
    const res = await fetch("/api/admin/competition/checklist");
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  }

  async function fetchBatteries() {
    const res = await fetch("/api/admin/competition/batteries");
    const data = await res.json();
    setBatteries(data.batteries || []);
  }

  useEffect(() => {
    fetchConfig();
    fetchChecklist();
    fetchBatteries();
  }, []);

  async function handleSaveConfig() {
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = {
      teamKey: teamKey.trim(),
      eventKey: eventKey.trim(),
      pollInterval,
      twitchChannel: twitchChannel.trim(),
      twitchPopupSize,
    };
    if (tbaApiKey.trim()) {
      body.tbaApiKey = tbaApiKey.trim();
    }

    await fetch("/api/admin/settings/competition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);
    setSaveLabel("Saved!");
    setTbaApiKey("");
    if (tbaApiKey.trim()) {
      setHasApiKey(true);
    }
    setTimeout(() => setSaveLabel("Save"), 2000);
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/competition");
      if (res.ok) {
        setTestResult({ ok: true, message: "Connection successful! TBA data fetched." });
      } else {
        const data = await res.json().catch(() => ({}));
        setTestResult({
          ok: false,
          message: data.error || `Connection failed (${res.status})`,
        });
      }
    } catch {
      setTestResult({ ok: false, message: "Connection failed. Check your configuration." });
    } finally {
      setTesting(false);
    }
  }

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    await fetch("/api/admin/settings/competition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
  }

  // Checklist CRUD
  async function handleChecklistSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formText.trim()) return;

    if (editingId) {
      await fetch(`/api/admin/competition/checklist/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: formText.trim() }),
      });
    } else {
      await fetch("/api/admin/competition/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: formText.trim() }),
      });
    }

    setShowForm(false);
    setEditingId(null);
    setFormText("");
    fetchChecklist();
  }

  async function toggleItemActive(item: ChecklistItem) {
    await fetch(`/api/admin/competition/checklist/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    fetchChecklist();
  }

  async function deleteItem(id: number) {
    if (!confirm("Delete this checklist item?")) return;
    await fetch(`/api/admin/competition/checklist/${id}`, { method: "DELETE" });
    fetchChecklist();
  }

  function startEdit(item: ChecklistItem) {
    setFormText(item.text);
    setEditingId(item.id);
    setShowForm(true);
  }

  async function handleRobotImageSourceChange(source: "none" | "tba" | "upload") {
    if (source === "upload") return; // handled by file upload
    setRobotImageSource(source);
    await fetch("/api/admin/settings/robot-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source }),
    });
  }

  async function handleRobotImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const formData = new FormData();
    formData.append("image", file);
    await fetch("/api/admin/settings/robot-image", {
      method: "POST",
      body: formData,
    });
    setRobotImageSource("upload");
    setUploadingImage(false);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  async function handleRemoveRobotImage() {
    await fetch("/api/admin/settings/robot-image", { method: "DELETE" });
    setRobotImageSource("none");
  }

  async function moveItem(index: number, direction: "up" | "down") {
    const newItems = [...items];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newItems.length) return;

    [newItems[index], newItems[swapIndex]] = [
      newItems[swapIndex],
      newItems[index],
    ];
    setItems(newItems);

    await fetch("/api/admin/competition/checklist/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: newItems.map((i) => i.id) }),
    });
  }

  // Battery CRUD
  async function handleBatterySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!batteryFormLabel.trim()) return;

    if (batteryEditingId) {
      await fetch(`/api/admin/competition/batteries/${batteryEditingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: batteryFormLabel.trim() }),
      });
    } else {
      await fetch("/api/admin/competition/batteries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: batteryFormLabel.trim() }),
      });
    }

    setBatteryShowForm(false);
    setBatteryEditingId(null);
    setBatteryFormLabel("");
    fetchBatteries();
  }

  async function toggleBatteryActive(battery: BatteryItem) {
    await fetch(`/api/admin/competition/batteries/${battery.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !battery.active }),
    });
    fetchBatteries();
  }

  async function deleteBattery(id: number) {
    if (!confirm("Delete this battery and all its logs?")) return;
    await fetch(`/api/admin/competition/batteries/${id}`, { method: "DELETE" });
    fetchBatteries();
  }

  function startBatteryEdit(battery: BatteryItem) {
    setBatteryFormLabel(battery.label);
    setBatteryEditingId(battery.id);
    setBatteryShowForm(true);
  }

  function batteryStatusLabel(status: string | null): string {
    if (!status) return "No status";
    const labels: Record<string, string> = {
      charging: "Charging",
      in_robot_match: "In Robot (Match)",
      in_robot_testing: "In Robot (Testing)",
      idle: "Not in Use",
    };
    return labels[status] || status;
  }

  async function handleBatteryReset() {
    if (!confirm("Reset all active batteries to 'Not in Use'? Log history will be preserved.")) return;
    setResetting(true);
    try {
      const res = await fetch("/api/admin/competition/batteries/reset", { method: "POST" });
      const data = await res.json();
      if (data.reset !== undefined) {
        fetchBatteries();
        // Refresh history if it was already loaded
        if (historyLoaded) fetchBatteryHistory();
      }
    } finally {
      setResetting(false);
    }
  }

  async function fetchBatteryHistory() {
    const res = await fetch("/api/admin/competition/batteries/history");
    const data = await res.json();
    setHistoryDays(data.days || []);
    setHistoryLoaded(true);
  }

  function toggleHistory() {
    const opening = !historyOpen;
    setHistoryOpen(opening);
    if (opening && !historyLoaded) {
      fetchBatteryHistory();
    }
  }

  async function handleRetireBattery(battery: BatteryItem) {
    if (battery.retired) {
      // Unretire — just clear retired flag (admin manually re-activates)
      if (!confirm(`Unretire "${battery.label}"?`)) return;
      await fetch(`/api/admin/competition/batteries/${battery.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retired: false }),
      });
    } else {
      if (!confirm(`Retire "${battery.label}"? It will be deactivated and hidden from the dashboard.`)) return;
      await fetch(`/api/admin/competition/batteries/${battery.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retired: true, active: false }),
      });
    }
    fetchBatteries();
  }

  async function fetchMatchAudit() {
    const res = await fetch("/api/admin/competition/batteries/matches");
    const data = await res.json();
    setMatchAuditData(data.matches || []);
    setMatchAuditLoaded(true);
  }

  function toggleMatchAudit() {
    const opening = !matchAuditOpen;
    setMatchAuditOpen(opening);
    if (opening && !matchAuditLoaded) {
      fetchMatchAudit();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Competition</h1>
      </div>

      {/* Example Mode */}
      <div className={`rounded-xl shadow border p-6 mb-6 ${exampleMode ? "bg-amber-50 border-amber-200" : "bg-white border-slate-100"}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Example Mode</h2>
            <p className="text-sm text-slate-500 mt-1">
              Show fake demo data on the competition dashboard. Useful for showing students what it looks like.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              const next = !exampleMode;
              setExampleMode(next);
              await fetch("/api/admin/settings/competition", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ exampleMode: next }),
              });
            }}
            className={`text-xs font-semibold px-2 py-1 rounded ${
              exampleMode
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {exampleMode ? "Enabled" : "Disabled"}
          </button>
        </div>
      </div>

      {/* TBA Configuration */}
      <div
        className="bg-white rounded-xl shadow border border-slate-100 p-6 mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">TBA Configuration</h2>
          <button
            type="button"
            onClick={toggleEnabled}
            className={`text-xs font-semibold px-2 py-1 rounded ${
              enabled
                ? "bg-green-100 text-green-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {enabled ? "Enabled" : "Disabled"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              TBA API Key
            </label>
            <input
              type="password"
              value={tbaApiKey}
              onChange={(e) => setTbaApiKey(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder={
                hasApiKey
                  ? "Key saved (enter new to replace)"
                  : "Enter TBA API key"
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Team Number
            </label>
            <input
              type="text"
              value={teamKey}
              onChange={(e) => setTeamKey(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="e.g. 9431"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Event Key</label>
            <input
              type="text"
              value={eventKey}
              onChange={(e) => setEventKey(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="e.g. 2025txhou"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Poll Interval (seconds)
            </label>
            <input
              type="number"
              value={pollInterval}
              onChange={(e) => setPollInterval(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              min={15}
              max={300}
            />
          </div>
        </div>

        {testResult && (
          <div
            className={`px-4 py-3 rounded-lg mb-4 ${
              testResult.ok
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {testResult.message}
          </div>
        )}

        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testing}
          className="bg-navy text-white px-4 py-2 rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50 text-sm"
        >
          {testing ? "Testing..." : "Test Connection"}
        </button>
      </div>

      {/* Robot Image */}
      <div className="bg-white rounded-xl shadow border border-slate-100 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Robot Image</h2>
        <p className="text-sm text-slate-500 mb-4">
          Show a robot photo in the top-right of the competition dashboard header.
        </p>

        <div className="space-y-3 mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="robotImageSource"
              checked={robotImageSource === "none"}
              onChange={() => handleRobotImageSourceChange("none")}
              className="accent-primary"
            />
            <span className="text-sm font-medium">None</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="robotImageSource"
              checked={robotImageSource === "tba"}
              onChange={() => handleRobotImageSourceChange("tba")}
              className="accent-primary"
            />
            <span className="text-sm font-medium">From The Blue Alliance</span>
          </label>
          {robotImageSource === "tba" && (
            <p className="text-xs text-slate-500 ml-7">
              Uses the team media from TBA for the current year. Requires valid TBA config above.
            </p>
          )}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="robotImageSource"
              checked={robotImageSource === "upload"}
              onChange={() => {
                // Trigger file picker
                document.getElementById("robot-image-upload")?.click();
              }}
              className="accent-primary"
            />
            <span className="text-sm font-medium">Custom Upload</span>
          </label>
        </div>

        {/* Upload input (hidden) */}
        <input
          id="robot-image-upload"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={handleRobotImageUpload}
          className="hidden"
        />

        {/* Upload button when custom is selected */}
        {robotImageSource === "upload" && (
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={() => document.getElementById("robot-image-upload")?.click()}
              disabled={uploadingImage}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {uploadingImage ? "Uploading..." : "Replace Image"}
            </button>
            <button
              type="button"
              onClick={handleRemoveRobotImage}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              Remove
            </button>
          </div>
        )}

        {/* Preview */}
        {robotImageSource !== "none" && (
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 inline-block">
            <p className="text-xs text-slate-500 mb-2">Preview</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/robot-image?t=${Date.now()}`}
              alt="Robot"
              className="h-20 w-20 object-cover rounded-lg bg-slate-200"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
      </div>

      {/* Pit Timer */}
      <div className="bg-white rounded-xl shadow border border-slate-100 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Pit Timer</h2>
            <p className="text-sm text-slate-500 mt-1">
              Show a LiveSplit-style stopwatch on the competition dashboard for timing battery swaps.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              const next = !pitTimerEnabled;
              setPitTimerEnabled(next);
              await fetch("/api/admin/settings/competition", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pitTimerEnabled: next }),
              });
            }}
            className={`text-xs font-semibold px-2 py-1 rounded ${
              pitTimerEnabled
                ? "bg-green-100 text-green-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {pitTimerEnabled ? "Enabled" : "Disabled"}
          </button>
        </div>
      </div>

      {/* Livestream */}
      <div className="bg-white rounded-xl shadow border border-slate-100 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Livestream</h2>
        <p className="text-sm text-slate-500 mb-4">
          Show a Twitch livestream popup button on the competition dashboard.
        </p>
        <div>
          <label className="block text-sm font-medium mb-1">
            Twitch Channel Name
          </label>
          <input
            type="text"
            value={twitchChannel}
            onChange={(e) => setTwitchChannel(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
            placeholder="e.g. firstinspires"
          />
          <p className="text-xs text-slate-400 mt-1">
            Leave blank to hide the stream button. Just the channel name, not the full URL.
          </p>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">
            Popup Size: {twitchPopupSize}% of screen width
          </label>
          <input
            type="range"
            value={twitchPopupSize}
            onChange={(e) => setTwitchPopupSize(Number(e.target.value))}
            className="w-full accent-purple-500"
            min={10}
            max={100}
            step={5}
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>10%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Save Settings Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-8 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Save changes to TBA configuration and livestream settings.
          <br />
          <span className="text-xs text-slate-400">Toggles and robot image save automatically.</span>
        </p>
        <button
          type="button"
          onClick={handleSaveConfig}
          disabled={saving}
          className="bg-primary text-white px-6 py-2.5 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 text-sm font-semibold"
        >
          {saving ? "Saving..." : saveLabel}
        </button>
      </div>

      {/* Pre-Match Checklist */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Pre-Match Checklist</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormText("");
          }}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm"
        >
          Add Item
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleChecklistSubmit}
          className="bg-white rounded-xl shadow border border-slate-100 p-6 mb-6 space-y-4"
        >
          <h3 className="font-semibold">
            {editingId ? "Edit Item" : "New Checklist Item"}
          </h3>
          <div>
            <label className="block text-sm font-medium mb-1">
              Item Text
            </label>
            <input
              type="text"
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="e.g. Check battery voltage"
              required
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm"
            >
              {editingId ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="text-slate-500 hover:text-slate-700 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-slate-500 italic">
          No checklist items yet. Add one to get started!
        </p>
      ) : (
        <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-semibold w-20">
                  Order
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Item
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold w-24">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr
                  key={item.id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveItem(index, "up")}
                        disabled={index === 0}
                        className="text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                        title="Move up"
                      >
                        &#9650;
                      </button>
                      <button
                        onClick={() => moveItem(index, "down")}
                        disabled={index === items.length - 1}
                        className="text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                        title="Move down"
                      >
                        &#9660;
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{item.text}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleItemActive(item)}
                      className={`text-xs font-semibold px-2 py-1 rounded ${
                        item.active
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {item.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => startEdit(item)}
                      className="text-sm text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-sm text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Battery Tracking */}
      <div className="flex items-center justify-between mb-4 mt-8">
        <h2 className="text-lg font-semibold">Battery Tracking</h2>
        <div className="flex gap-2">
          {batteries.length > 0 && (
            <>
              <a
                href="/admin/dashboard/competition/batteries/print"
                target="_blank"
                className="bg-navy text-white px-4 py-2 rounded-lg hover:bg-navy-dark transition-colors text-sm"
              >
                Print QR Codes
              </a>
              <button
                onClick={handleBatteryReset}
                disabled={resetting}
                className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors text-sm disabled:opacity-50"
              >
                {resetting ? "Resetting..." : "Reset All"}
              </button>
            </>
          )}
          <button
            onClick={() => {
              setBatteryShowForm(true);
              setBatteryEditingId(null);
              setBatteryFormLabel("");
            }}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm"
          >
            Add Battery
          </button>
        </div>
      </div>

      {batteryShowForm && (
        <form
          onSubmit={handleBatterySubmit}
          className="bg-white rounded-xl shadow border border-slate-100 p-6 mb-6 space-y-4"
        >
          <h3 className="font-semibold">
            {batteryEditingId ? "Edit Battery" : "New Battery"}
          </h3>
          <div>
            <label className="block text-sm font-medium mb-1">
              Battery Label
            </label>
            <input
              type="text"
              value={batteryFormLabel}
              onChange={(e) => setBatteryFormLabel(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder='e.g. "Battery 1" or "Battery A"'
              required
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm"
            >
              {batteryEditingId ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setBatteryShowForm(false);
                setBatteryEditingId(null);
              }}
              className="text-slate-500 hover:text-slate-700 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {batteries.length === 0 ? (
        <p className="text-slate-500 italic">
          No batteries configured. Add one to start tracking!
        </p>
      ) : (
        <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Label
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold w-40">
                  Current Status
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold w-20">
                  Cycles
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold w-24">
                  Last V
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold w-24">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold w-44">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {batteries.map((battery) => (
                <tr
                  key={battery.id}
                  className={`border-t border-slate-100 hover:bg-slate-50 ${battery.retired ? "opacity-50" : ""}`}
                >
                  <td className="px-4 py-3 font-medium">
                    {battery.label}
                    {battery.retired && (
                      <span className="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700">RETIRED</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {batteryStatusLabel(battery.currentStatus)}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-slate-500 tabular-nums">
                    {battery.cycleCount}
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-mono text-slate-500">
                    {battery.lastVoltage !== null ? `${battery.lastVoltage.toFixed(1)}V` : "--"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleBatteryActive(battery)}
                      className={`text-xs font-semibold px-2 py-1 rounded ${
                        battery.active
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {battery.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => startBatteryEdit(battery)}
                      className="text-sm text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleRetireBattery(battery)}
                      className={`text-sm hover:underline ${battery.retired ? "text-green-600" : "text-amber-600"}`}
                    >
                      {battery.retired ? "Unretire" : "Retire"}
                    </button>
                    <button
                      onClick={() => deleteBattery(battery.id)}
                      className="text-sm text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Battery Usage Log */}
      {batteries.length > 0 && (
        <div className="mt-6">
          <button
            onClick={toggleHistory}
            className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
          >
            <span className={`inline-block transition-transform ${historyOpen ? "rotate-90" : ""}`}>
              &#9654;
            </span>
            Battery Usage Log
          </button>

          {historyOpen && (
            <div className="mt-3 space-y-4">
              {!historyLoaded ? (
                <p className="text-slate-500 text-sm">Loading...</p>
              ) : historyDays.length === 0 ? (
                <p className="text-slate-500 text-sm italic">No battery activity in the last 14 days.</p>
              ) : (
                historyDays.map((day) => (
                  <div
                    key={day.date}
                    className="bg-white rounded-xl shadow border border-slate-100 p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm">{day.date}</h4>
                      <span className="text-xs text-slate-400">
                        {day.totalChanges} status change{day.totalChanges !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {day.batteries.map((b) => (
                        <div
                          key={b.label}
                          className="bg-slate-50 rounded-lg px-3 py-2 text-sm"
                        >
                          <span className="font-medium">{b.label}</span>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {b.matches > 0 && (
                              <span className="mr-2">{b.matches} match{b.matches !== 1 ? "es" : ""}</span>
                            )}
                            {b.changes} change{b.changes !== 1 ? "s" : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Match Battery Audit */}
      {batteries.length > 0 && (
        <div className="mt-4">
          <button
            onClick={toggleMatchAudit}
            className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
          >
            <span className={`inline-block transition-transform ${matchAuditOpen ? "rotate-90" : ""}`}>
              &#9654;
            </span>
            Match Battery Audit
          </button>

          {matchAuditOpen && (
            <div className="mt-3 space-y-4">
              {!matchAuditLoaded ? (
                <p className="text-slate-500 text-sm">Loading...</p>
              ) : matchAuditData.length === 0 ? (
                <p className="text-slate-500 text-sm italic">No match battery logs yet.</p>
              ) : (
                matchAuditData.map((match) => (
                  <div
                    key={match.matchKey}
                    className="bg-white rounded-xl shadow border border-slate-100 p-4"
                  >
                    <h4 className="font-semibold text-sm mb-2">{match.matchKey}</h4>
                    <div className="space-y-1.5">
                      {match.batteries.map((b, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="font-medium w-24 flex-shrink-0">{b.label}</span>
                          <span className="text-xs text-slate-500 w-28 flex-shrink-0">{batteryStatusLabel(b.status)}</span>
                          <span className="text-xs font-mono text-slate-500 w-14 flex-shrink-0">
                            {b.voltage !== null ? `${b.voltage.toFixed(1)}V` : "--"}
                          </span>
                          {b.note && (
                            <span className="text-xs text-slate-400 italic truncate">{b.note}</span>
                          )}
                          <span className="text-xs text-slate-400 ml-auto flex-shrink-0">
                            {new Date(b.createdAt).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                              timeZone: "America/Chicago",
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
