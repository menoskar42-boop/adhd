import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  deleteScheduledTask,
  getScheduledTasks,
  type ScheduledTask,
  updateScheduledTask,
} from "@/lib/storage";
import { getPlaces, type Place } from "@/lib/places";
import { theme } from "@/lib/theme";

const DURATION_PRESETS = [5, 10, 15, 20, 25] as const;

export default function Scheduled() {
  const [, navigate] = useLocation();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [editing, setEditing] = useState<ScheduledTask | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDuration, setEditDuration] = useState<number>(10);
  const [editPlaceId, setEditPlaceId] = useState<string>("");

  useEffect(() => {
    setTasks(getScheduledTasks());
    setPlaces(getPlaces());
  }, []);

  const openEdit = (task: ScheduledTask) => {
    setEditing(task);
    setEditTitle(task.title);
    setEditDuration(task.currentDuration);
    setEditPlaceId(task.locationId);
  };

  const closeEdit = () => setEditing(null);

  const saveEdit = () => {
    if (!editing) return;
    const trimmed = editTitle.trim();
    if (!trimmed || !editPlaceId) return;
    updateScheduledTask(editing.id, {
      title: trimmed,
      currentDuration: editDuration,
      locationId: editPlaceId,
    });
    setTasks(getScheduledTasks());
    setEditing(null);
  };

  const placeName = (id: string): string => {
    const p = places.find((pl) => pl.id === id);
    return p?.name ?? "مكان محذوف";
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("تحذف المهمة المجدولة دى؟")) return;
    deleteScheduledTask(id);
    setTasks(getScheduledTasks());
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
          <h1 className="text-2xl font-bold">المهام المجدولة</h1>
        </div>

        {tasks.length === 0 ? (
          <div className="text-center py-12">
            <p
              className="text-base leading-7"
              style={{ color: "#6B7E80" }}
            >
              محدش مجدول لسه.
              <br />
              ارجع وأضف مهمة مرتبطة بمكان!
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {tasks
              .slice()
              .sort((a, b) => a.createdAt - b.createdAt)
              .map((task) => (
                <li
                  key={task.id}
                  className="bg-white rounded-xl border px-4 py-3 space-y-2"
                  style={{ borderColor: "#E0E7E3" }}
                >
                  <p className="text-sm" style={{ color: "#2E6B4A" }}>
                    📍 {placeName(task.locationId)}
                  </p>
                  <p
                    className="text-lg font-bold"
                    style={{ color: theme.colors.text }}
                  >
                    {task.title}
                  </p>
                  <p className="text-sm" style={{ color: "#6B7E80" }}>
                    {task.currentDuration} دقيقة
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => openEdit(task)}
                      aria-label="تعديل"
                      className="rounded-lg px-3 py-1.5 text-sm font-medium border"
                      style={{
                        borderColor: theme.colors.primary,
                        color: theme.colors.primary,
                      }}
                    >
                      ✏️ تعديل
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      aria-label="حذف"
                      className="rounded-lg px-3 py-1.5 text-sm font-medium"
                      style={{ backgroundColor: "#FFE8E8", color: "#C0392B" }}
                    >
                      🗑️ حذف
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-xl"
            style={{ direction: "rtl" }}
          >
            <h2
              className="text-xl font-bold"
              style={{ color: theme.colors.text }}
            >
              تعديل المهمة
            </h2>

            <div className="space-y-2">
              <label
                className="block text-sm font-medium"
                style={{ color: "#6B7E80" }}
              >
                اسم المهمة
              </label>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="اسم المهمة"
                className="w-full rounded-xl border-2 px-3 py-2 text-base outline-none bg-white"
                style={{
                  borderColor: theme.colors.primary,
                  textAlign: "right",
                }}
              />
            </div>

            <div className="space-y-2">
              <label
                className="block text-sm font-medium"
                style={{ color: "#6B7E80" }}
              >
                المدة (دقيقة)
              </label>
              <div className="grid grid-cols-5 gap-2">
                {DURATION_PRESETS.map((mins) => {
                  const active = editDuration === mins;
                  return (
                    <button
                      key={mins}
                      onClick={() => setEditDuration(mins)}
                      className="rounded-lg py-2 text-sm font-semibold border-2"
                      style={{
                        borderColor: theme.colors.primary,
                        backgroundColor: active
                          ? theme.colors.primary
                          : "transparent",
                        color: active ? "#fff" : theme.colors.primary,
                      }}
                    >
                      {mins}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label
                className="block text-sm font-medium"
                style={{ color: "#6B7E80" }}
              >
                المكان
              </label>
              <div className="flex gap-2 flex-wrap">
                {places.map((p) => {
                  const active = editPlaceId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setEditPlaceId(p.id)}
                      className="rounded-full border-2 px-3 py-1.5 text-sm font-medium"
                      style={{
                        borderColor: theme.colors.primary,
                        backgroundColor: active
                          ? theme.colors.primary
                          : "transparent",
                        color: active ? "#fff" : theme.colors.primary,
                      }}
                    >
                      📍 {p.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={saveEdit}
                disabled={!editTitle.trim() || !editPlaceId}
                className="flex-1 rounded-xl py-3 text-base font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: theme.colors.primary }}
              >
                حفظ
              </button>
              <button
                onClick={closeEdit}
                className="rounded-xl px-4 py-3 text-base font-medium"
                style={{ color: "#6B7E80" }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
