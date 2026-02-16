export default function EditableField({ value = 0, onChange }) {
  return (
    <input
      type="number"
      className="w-10 rounded border border-gray-300 px-1 py-0.5 text-center text-sm"
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
    />
  );
}
