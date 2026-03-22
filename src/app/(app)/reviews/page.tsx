"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { format, startOfWeek } from "date-fns";
import { BookOpen, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

function getMonday(d: Date): string {
  const mon = startOfWeek(d, { weekStartsOn: 1 });
  return format(mon, "yyyy-MM-dd");
}

export default function ReviewsPage() {
  const { userId } = useCurrentUser();
  const reviews = useQuery(api.weeklyReviews.listByUser, userId ? { userId } : "skip") ?? [];
  const tasks = useQuery(api.tasks.listByUser, userId ? { userId } : "skip") ?? [];
  const upsert = useMutation(api.weeklyReviews.upsert);

  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const thisWeek = getMonday(new Date());
  const [content, setContent] = useState("");
  const [wins, setWins] = useState("");
  const [improvements, setImprovements] = useState("");
  const [saving, setSaving] = useState(false);

  // Auto-calculate tasks completed/missed this week
  const weekStart = new Date(thisWeek).getTime();
  const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
  const weekTasks = tasks.filter(
    (t) => t.createdAt >= weekStart && t.createdAt < weekEnd
  );
  const tasksCompleted = weekTasks.filter((t) => t.status === "done").length;
  const tasksMissed = weekTasks.filter(
    (t) => t.status !== "done" && t.dueDate && t.dueDate < Date.now()
  ).length;

  const existingThisWeek = reviews.find((r) => r.weekOf === thisWeek);

  const handleSave = async () => {
    if (!userId || !content.trim()) return;
    setSaving(true);
    try {
      await upsert({
        userId,
        weekOf: thisWeek,
        content: content.trim(),
        wins: wins.trim() || undefined,
        improvements: improvements.trim() || undefined,
        tasksCompleted,
        tasksMissed,
      });
      setContent("");
      setWins("");
      setImprovements("");
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleEditExisting = () => {
    if (existingThisWeek) {
      setContent(existingThisWeek.content);
      setWins(existingThisWeek.wins ?? "");
      setImprovements(existingThisWeek.improvements ?? "");
    }
    setShowForm(true);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[#191919] mb-1">Weekly Reviews</h1>
          <p className="text-[#9B9A97] font-ui text-sm">{reviews.length} reviews</p>
        </div>
        <button
          onClick={existingThisWeek ? handleEditExisting : () => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 border border-[#E3E3E1] rounded text-[13px] font-ui text-[#2383E2] hover:bg-[#F7F7F5] transition-colors"
        >
          <Plus size={14} />
          {existingThisWeek ? "Edit this week" : "Write this week"}
        </button>
      </div>

      {/* New review form */}
      {showForm && (
        <div className="border border-[#2383E2] rounded p-5 mb-6 bg-[#F7F7F5] space-y-4">
          <div className="flex items-center justify-between mb-1">
            <p className="font-ui text-[11px] tracking-[0.15em] uppercase text-[#2383E2]">
              Week of {format(new Date(thisWeek), "d MMMM yyyy")}
            </p>
            <div className="flex items-center gap-4 text-[11px] font-ui">
              <span className="text-[#4CAF6B]">{tasksCompleted} completed</span>
              <span className="text-[#E85538]">{tasksMissed} missed</span>
            </div>
          </div>

          <div>
            <label className="block text-[#9B9A97] font-ui text-[11px] tracking-[0.15em] uppercase mb-1.5">
              How did this week go?
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Reflect on the week. What happened? How did you feel? What did you learn?"
              rows={4}
              className="w-full bg-[#F0F0EE] border border-[#E3E3E1] rounded px-3 py-2.5 font-ui text-sm text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#2383E2] transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[#9B9A97] font-ui text-[11px] tracking-[0.15em] uppercase mb-1.5">
                Wins
              </label>
              <textarea
                value={wins}
                onChange={(e) => setWins(e.target.value)}
                placeholder="What went well?"
                rows={3}
                className="w-full bg-[#F0F0EE] border border-[#E3E3E1] rounded px-3 py-2.5 font-ui text-sm text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#4CAF6B] transition-colors resize-none"
              />
            </div>
            <div>
              <label className="block text-[#9B9A97] font-ui text-[11px] tracking-[0.15em] uppercase mb-1.5">
                To Improve
              </label>
              <textarea
                value={improvements}
                onChange={(e) => setImprovements(e.target.value)}
                placeholder="What could be better?"
                rows={3}
                className="w-full bg-[#F0F0EE] border border-[#E3E3E1] rounded px-3 py-2.5 font-ui text-sm text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#E8A838] transition-colors resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 font-ui text-[13px] text-[#9B9A97] hover:text-[#191919] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!content.trim() || saving}
              className="px-4 py-2 bg-[rgba(35,131,226,0.12)] border border-[#2383E2] rounded font-ui text-[13px] text-[#2383E2] hover:bg-[rgba(35,131,226,0.20)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving…" : "Save Review"}
            </button>
          </div>
        </div>
      )}

      {/* Review list */}
      {reviews.length === 0 && !showForm ? (
        <div className="text-center py-16 border border-[#E3E3E1] rounded">
          <BookOpen size={24} className="text-[#C4C4C2] mx-auto mb-3" />
          <p className="text-[#9B9A97] font-ui text-sm">No reviews yet.</p>
          <p className="text-[#C4C4C2] font-ui text-xs mt-1">
            Write your first weekly review to start tracking your progress.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {reviews.map((review) => {
            const isExpanded = expandedId === review._id;
            return (
              <div key={review._id} className="border border-[#E3E3E1] rounded bg-[#F7F7F5]">
                {/* Row header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : review._id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[#F0F0EE] transition-colors rounded"
                >
                  <p className="font-ui text-[11px] tracking-[0.15em] uppercase text-[#9B9A97] flex-1">
                    Week of {format(new Date(review.weekOf), "d MMMM yyyy")}
                  </p>
                  <span className="font-ui text-[11px] text-[#4CAF6B]">{review.tasksCompleted} done</span>
                  <span className="font-ui text-[11px] text-[#E85538]">{review.tasksMissed} missed</span>
                  {isExpanded
                    ? <ChevronUp size={14} className="text-[#9B9A97] shrink-0" />
                    : <ChevronDown size={14} className="text-[#9B9A97] shrink-0" />
                  }
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-[#E3E3E1] pt-4 space-y-4">
                    <p className="font-ui text-sm text-[#9B9A97] leading-relaxed">{review.content}</p>
                    {(review.wins || review.improvements) && (
                      <div className="grid grid-cols-2 gap-4">
                        {review.wins && (
                          <div>
                            <p className="font-ui text-[11px] tracking-[0.15em] uppercase text-[#4CAF6B] mb-1">Wins</p>
                            <p className="font-ui text-sm text-[#9B9A97] leading-relaxed">{review.wins}</p>
                          </div>
                        )}
                        {review.improvements && (
                          <div>
                            <p className="font-ui text-[11px] tracking-[0.15em] uppercase text-[#E8A838] mb-1">To Improve</p>
                            <p className="font-ui text-sm text-[#9B9A97] leading-relaxed">{review.improvements}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
