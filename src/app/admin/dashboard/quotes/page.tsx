"use client";

import { useState, useEffect } from "react";

interface Quote {
  id: number;
  text: string;
  author: string;
  active: boolean;
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ text: "", author: "" });

  async function fetchQuotes() {
    const res = await fetch("/api/admin/quotes");
    const data = await res.json();
    setQuotes(data.quotes || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchQuotes();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editingId
      ? `/api/admin/quotes/${editingId}`
      : "/api/admin/quotes";
    const method = editingId ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setShowForm(false);
    setEditingId(null);
    setForm({ text: "", author: "" });
    fetchQuotes();
  }

  async function toggleActive(quote: Quote) {
    await fetch(`/api/admin/quotes/${quote.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !quote.active }),
    });
    fetchQuotes();
  }

  async function deleteQuote(id: number) {
    if (!confirm("Delete this quote?")) return;
    await fetch(`/api/admin/quotes/${id}`, { method: "DELETE" });
    fetchQuotes();
  }

  function startEdit(quote: Quote) {
    setForm({ text: quote.text, author: quote.author });
    setEditingId(quote.id);
    setShowForm(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Quotes</h1>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setForm({ text: "", author: "" });
          }}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm"
        >
          Add Quote
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow border border-slate-100 p-6 mb-6 space-y-4"
        >
          <h3 className="font-semibold">
            {editingId ? "Edit Quote" : "New Quote"}
          </h3>
          <div>
            <label className="block text-sm font-medium mb-1">Quote Text</label>
            <textarea
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              rows={3}
              placeholder="Enter a quote or fun fact..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Author (optional)
            </label>
            <input
              type="text"
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="e.g. Albert Einstein"
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
      ) : quotes.length === 0 ? (
        <p className="text-slate-500 italic">
          No quotes yet. Add one to get started!
        </p>
      ) : (
        <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Quote
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Author
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr
                  key={q.id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 max-w-md">
                    <div className="truncate">{q.text}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {q.author || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(q)}
                      className={`text-xs font-semibold px-2 py-1 rounded ${
                        q.active
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {q.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => startEdit(q)}
                      className="text-sm text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteQuote(q.id)}
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
