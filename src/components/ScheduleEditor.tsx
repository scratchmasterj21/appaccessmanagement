import { useState } from 'react';
import type { Schedule, TimeWindow } from '../types';
import { DAYS } from '../types';
import './ScheduleEditor.css';

type Props = {
  schedule: Schedule;
  onChange: (schedule: Schedule) => void;
};

function timeWindowKey(w: TimeWindow) {
  return `${w.start}-${w.end}`;
}

function TimeWindowRow({
  window,
  onRemove,
}: {
  window: TimeWindow;
  onRemove: () => void;
}) {
  return (
    <div className="time-window-row">
      <span>{window.start} – {window.end}</span>
      <button type="button" className="danger small" onClick={onRemove}>Remove</button>
    </div>
  );
}

function DaySection({
  day,
  windows,
  onChange,
}: {
  day: keyof Schedule;
  windows: TimeWindow[];
  onChange: (windows: TimeWindow[]) => void;
}) {
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');

  const add = () => {
    if (!start || !end) return;
    onChange([...windows, { start, end }]);
  };

  const remove = (idx: number) => () => {
    onChange(windows.filter((_, i) => i !== idx));
  };

  return (
    <div className="day-section">
      <strong>{day}</strong>
      <div className="time-windows">
        {windows.map((w, i) => (
          <TimeWindowRow key={timeWindowKey(w)} window={w} onRemove={remove(i)} />
        ))}
      </div>
      <div className="add-window">
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        <span>–</span>
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        <button type="button" onClick={add}>Add</button>
      </div>
    </div>
  );
}

export default function ScheduleEditor({ schedule, onChange }: Props) {
  const [mode, setMode] = useState<'weekdays' | 'days'>('weekdays');

  const updateDay = (day: keyof Schedule) => (windows: TimeWindow[]) => {
    onChange({ ...schedule, [day]: windows });
  };

  return (
    <div className="schedule-editor">
      <div className="schedule-mode">
        <label>
          <input
            type="radio"
            name="schedule-mode"
            checked={mode === 'weekdays'}
            onChange={() => setMode('weekdays')}
          />
          Weekdays / Weekends
        </label>
        <label>
          <input
            type="radio"
            name="schedule-mode"
            checked={mode === 'days'}
            onChange={() => setMode('days')}
          />
          Per day
        </label>
      </div>

      {mode === 'weekdays' && (
        <>
          <DaySection
            day="weekdays"
            windows={schedule.weekdays ?? []}
            onChange={updateDay('weekdays')}
          />
          <DaySection
            day="weekends"
            windows={schedule.weekends ?? []}
            onChange={updateDay('weekends')}
          />
        </>
      )}

      {mode === 'days' && (
        <div className="days-grid">
          {DAYS.map((day) => (
            <DaySection
              key={day}
              day={day}
              windows={schedule[day] ?? []}
              onChange={updateDay(day)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
