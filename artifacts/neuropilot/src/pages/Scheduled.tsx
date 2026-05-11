import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  deleteScheduledTask,
  getScheduledTasks,
  type ScheduledTask,
} from "@/lib/storage";
import { getPlaces, type Place } from "@/lib/places";
import { theme } from "@/lib/theme";

export default function Scheduled() {
  const [, navigate] = useLocation();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);

  useEffect(() => {
    setTasks(getScheduledTasks());
    setPlaces(getPlaces());
  }, []);

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
    </main>
  );
}
