import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { deletePlace, getPlaces, type Place, savePlace } from "@/lib/places";
import { theme } from "@/lib/theme";

export default function Places() {
  const [, navigate] = useLocation();
  const [places, setPlaces] = useState<Place[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPlaces(getPlaces());
  }, []);

  const handleSaveHere = async () => {
    const name = nameInput.trim();
    if (!name) {
      window.alert("اكتب اسم المكان الأول");
      return;
    }
    if (!("geolocation" in navigator)) {
      window.alert("المتصفح ده مش بيدعم تحديد الموقع.");
      return;
    }

    setSaving(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15_000,
        });
      });
      savePlace({
        id: Date.now().toString(),
        name,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      setNameInput("");
      setPlaces(getPlaces());
    } catch {
      window.alert("مقدرناش نحصل على موقعك دلوقتي. حاول تاني.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("تمسح المكان ده؟")) return;
    deletePlace(id);
    setPlaces(getPlaces());
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
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="text-base font-medium"
            style={{ color: theme.colors.primary }}
          >
            ← رجوع
          </button>
          <h1 className="text-2xl font-bold">أماكنك</h1>
        </div>

        {/* Save current location */}
        <div className="space-y-3">
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveHere()}
            placeholder="اسم المكان (مثلاً: البيت، الشغل)"
            className="w-full rounded-xl border-2 px-4 py-4 text-base outline-none bg-white"
            style={{ borderColor: theme.colors.primary, textAlign: "right" }}
          />
          <button
            onClick={handleSaveHere}
            disabled={saving}
            className="w-full rounded-xl py-4 text-lg font-semibold text-white disabled:opacity-70"
            style={{ backgroundColor: theme.colors.primary }}
          >
            {saving ? "جارى الحفظ…" : "📍 احفظ موقعى الحالى"}
          </button>
        </div>

        {/* Saved places list */}
        {places.length === 0 ? (
          <div className="text-center py-12">
            <p
              className="text-base leading-7"
              style={{ color: "#6B7E80" }}
            >
              محدش محفوظ لسه.
              <br />
              احفظ أماكنك المهمة وربطها بمهامك!
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {places.map((place) => (
              <li
                key={place.id}
                className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border"
                style={{ borderColor: "#E0E7E3" }}
              >
                <span className="text-xl">📍</span>
                <span className="flex-1 text-base font-medium">{place.name}</span>
                <button
                  onClick={() => handleDelete(place.id)}
                  aria-label="مسح"
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "#FFE8E8", color: "#C0392B" }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
