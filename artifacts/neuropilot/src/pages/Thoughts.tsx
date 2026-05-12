import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  clearAllThoughts,
  deleteThought,
  getThoughts,
  type Thought,
} from "@/lib/thoughts";
import { theme } from "@/lib/theme";

export default function Thoughts() {
  const [, navigate] = useLocation();
  const [thoughts, setThoughts] = useState<Thought[]>([]);

  useEffect(() => {
    setThoughts(getThoughts());
  }, []);

  const handleDelete = (id: string) => {
    deleteThought(id);
    setThoughts(getThoughts());
  };

  // Promote a thought into the task input on Home. sessionStorage is
  // the simplest hand-off — Wouter doesn't carry navigation state,
  // and the key is single-use (Home clears it on read).
  const handleScheduleAsTask = (text: string) => {
    sessionStorage.setItem("neuropilot-prefill-task", text);
    navigate("/");
  };

  const handleClearAll = () => {
    if (!window.confirm("تمسح كل الأفكار؟")) return;
    clearAllThoughts();
    setThoughts([]);
  };

  return (
    <main
      className="min-h-screen w-full px-6 py-6"
      style={{
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        direction: "rtl",
      }}
    >
      <div className="w-full max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="text-base font-medium"
            style={{ color: theme.colors.primary }}
          >
            ← رجوع
          </button>
          <h1 className="text-2xl font-bold">💭 أفكارى</h1>
          {thoughts.length > 0 && (
            <button
              onClick={handleClearAll}
              className="ms-auto text-sm font-medium"
              style={{ color: "#C0392B" }}
            >
              مسح الكل
            </button>
          )}
        </div>

        {thoughts.length === 0 ? (
          <div className="text-center py-12">
            <p
              className="text-base leading-7"
              style={{ color: "#6B7E80" }}
            >
              مفيش أفكار محفوظة لسه.
              <br />
              لما تكون فى مهمة وفكرة تيجى فى دماغك، اضغط 💭 وسجّلها هنا.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {thoughts
              .slice()
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((t) => (
                <li
                  key={t.id}
                  className="bg-white rounded-xl border px-4 py-3 space-y-2"
                  style={{ borderColor: "#E0E7E3" }}
                >
                  <p
                    className="text-base whitespace-pre-wrap"
                    style={{ color: theme.colors.text }}
                  >
                    {t.text}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs" style={{ color: "#6B7E80" }}>
                      {new Date(t.createdAt).toLocaleString("ar-EG", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleScheduleAsTask(t.text)}
                        className="rounded-lg px-3 py-1 text-sm font-medium"
                        style={{
                          backgroundColor: "#EAF1EC",
                          color: theme.colors.primary,
                        }}
                      >
                        📋 اعملها مهمة
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        aria-label="حذف"
                        className="rounded-lg px-3 py-1 text-sm font-medium"
                        style={{ backgroundColor: "#FFE8E8", color: "#C0392B" }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>
    </main>
  );
}
