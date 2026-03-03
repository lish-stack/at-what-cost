import { Link } from "react-router-dom";
import LifecycleBadge from "./LifecycleBadge";

export default function CommitmentCard({ commitment }) {
  const daysRemaining = calculateDaysRemaining(commitment.deadline_date);
  const phase = getLifecyclePhase(daysRemaining);

  return (
    <Link
      to={`/commitments/${commitment.id}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div style={styles.card}>
        <h3 style={styles.company}>{commitment.company?.name}</h3>
        <p style={styles.meta}>
          Deadline: {commitment.deadline_date}
        </p>

        <LifecycleBadge phase={phase} />

        <p style={styles.days}>
          {daysRemaining >= 0
            ? `${daysRemaining} days remaining`
            : `${Math.abs(daysRemaining)} days overdue`}
        </p>
      </div>
    </Link>
  );
}

function calculateDaysRemaining(date) {
  const deadline = new Date(date);
  const today = new Date();
  const diff = deadline - today;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getLifecyclePhase(days) {
  if (days > 30) return "pre_deadline";
  if (days <= 30 && days > 0) return "urgent";
  if (days === 0) return "deadline_today";
  return "overdue";
}

const styles = {
  card: {
    background: "white",
    padding: "20px",
    borderRadius: "12px",
    marginBottom: "16px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
  },
  company: {
    margin: 0,
    color: "#7d1f5c",
  },
  meta: {
    fontSize: "14px",
    color: "#666",
  },
  days: {
    marginTop: "8px",
    fontWeight: "600",
  },
};