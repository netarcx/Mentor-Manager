"use client";

import { useState, useEffect } from "react";

interface ChecklistItem {
  id: number;
  text: string;
  active: boolean;
  sortOrder: number;
}

export default function CompetitionPage() {
  // TBA config state
  const [enabled, setEnabled] = useState(false);
  const [tbaApiKey, setTbaApiKey] = useState("");
  const [teamKey, setTeamKey] = useState("");
  const [eventKey, setEventKey] = useState("");
  const [pollInterval, setPollInterval] = useState(60);
  const [hasApiKey, setHasApiKey] = useState(false);
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

  async function fetchConfig() {
    const res = await fetch("/api/admin/settings/competition");
    const data = await res.json();
    setEnabled(data.enabled ?? false);
    setTeamKey((data.teamKey ?? "").replace(/^frc/, ""));
    setEventKey(data.eventKey ?? "");
    setPollInterval(data.pollInterval ?? 60);
    setHasApiKey(data.hasApiKey ?? false);
    setRobotImageSource(data.robotImageSource ?? "none");
  }

  async function fetchChecklist() {
    const res = await fetch("/api/admin/competition/checklist");
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchConfig();
    fetchChecklist();
  }, []);

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = {
      enabled,
      teamKey: teamKey.trim(),
      eventKey: eventKey.trim(),
      pollInterval,
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
    setEnabled(!enabled);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Competition</h1>
      </div>

      {/* TBA Configuration */}
      <form
        onSubmit={handleSaveConfig}
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

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 text-sm"
          >
            {saving ? "Saving..." : saveLabel}
          </button>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="bg-navy text-white px-4 py-2 rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50 text-sm"
          >
            {testing ? "Testing..." : "Test Connection"}
          </button>
        </div>
      </form>

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
    </div>
  );
}
