"use client";

import { useState, useEffect } from "react";

interface DailyGoal {
  date: string;
  text: string;
  updatedAt: string;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/goals")
      .then((r) => r.json())
      .then((data) => setGoals(data.goals || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Daily Goals History</h1>

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : goals.length === 0 ? (
        <p className="text-slate-500 italic">
          No goals recorded yet. Goals are set from the public dashboard.
        </p>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => (
            <div
              key={goal.date}
              className="bg-white rounded-xl shadow border border-slate-100 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-navy">{goal.date}</h3>
                <span className="text-xs text-slate-400">
                  Last edited: {new Date(goal.updatedAt).toLocaleString()}
                </span>
              </div>
              {goal.text ? (
                <p className="text-slate-700 whitespace-pre-wrap">{goal.text}</p>
              ) : (
                <p className="text-slate-400 italic">No goals set</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
