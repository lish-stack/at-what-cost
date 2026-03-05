export default function LifecycleBadge({ phase }) {
  const config = {
    compliant: { label: "Compliant", color: "#4caf50" },
    pre_deadline: { label: "On Track", color: "#4caf50" },
    at_risk: { label: "At Risk", color: "#ff9800" },
    urgent: { label: "Approaching Deadline", color: "#ff9800" },
    deadline_today: { label: "Deadline Today", color: "#f44336" },
    overdue: { label: "Overdue", color: "#b71c1c" },
    unknown: { label: "Unknown", color: "#9e9e9e" },
  };

  const badge = config[phase] || config.unknown;

  return (
    <span
      style={{
        background: badge.color,
        color: "white",
        padding: "6px 12px",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: "600",
        display: "inline-block",
        marginTop: "10px",
      }}
    >
      {badge.label}
    </span>
  );
}