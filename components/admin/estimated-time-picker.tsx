'use client';
import { useState } from 'react';

export function EstimatedTimePicker({ initial, onSave }: { initial: number | null; onSave: (minutes: number) => void }) {
  const [minutes, setMinutes] = useState(String(initial ?? 15));
  return <div className="space-y-2 rounded-xl border border-blue/20 p-3">
    <label className="block text-sm font-bold">الوقت المقدر بالدقائق
      <input type="number" min={1} max={180} step={1} value={minutes} onChange={(event) => setMinutes(event.target.value)}
        className="mt-2 block min-h-11 w-full rounded-lg border border-blue/30 bg-white px-3" />
    </label>
    <div className="flex flex-wrap gap-2">
      {[5, 10, 15, 20, 30].map((value) => <button type="button" key={value} onClick={() => setMinutes(String(value))}
        aria-pressed={minutes === String(value)} className="min-h-11 rounded-full border border-blue px-3">{value} د</button>)}
    </div>
    <button type="button" disabled={!Number.isInteger(Number(minutes)) || Number(minutes) < 1 || Number(minutes) > 180}
      onClick={() => onSave(Number(minutes))} className="min-h-11 rounded-xl bg-blue px-4 text-white disabled:opacity-40">تحديث الوقت</button>
  </div>;
}
