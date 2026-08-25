export default function Toggle({ checked, onChange }) {
  return (
    <label className="teacher-switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i />
    </label>
  )
}
