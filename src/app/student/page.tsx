"use client";

import { useState } from "react";

export default function StudentPage() {
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/quotes/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, author }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit quote");
        return;
      }

      setMessage("Quote submitted! It will appear on the dashboard once approved.");
      setText("");
      setAuthor("");
    } catch {
      setError("Failed to submit quote");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Student Hub</h1>
      <p className="text-slate-500 mb-8">Resources and activities for team members.</p>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          {message}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Quote Submission */}
      <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
        <h2 className="text-lg font-semibold mb-1">Submit a Quote</h2>
        <p className="text-sm text-slate-500 mb-4">
          Suggest a quote or fun fact to display on the workshop dashboard. An admin will review it before it goes live.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Quote</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              rows={3}
              placeholder="Enter a quote, fun fact, or motivational message..."
              required
              maxLength={500}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Author (optional)
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              placeholder="e.g. Albert Einstein"
              maxLength={100}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 text-sm font-semibold"
          >
            {loading ? "Submitting..." : "Submit Quote"}
          </button>
        </form>
      </div>
    </div>
  );
}
