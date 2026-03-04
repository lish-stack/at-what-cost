import { Link } from "react-router-dom";
import LifecycleBadge from "./LifecycleBadge";

export default function CompanyCard({ name, company, commitments, worstPhase }) {
  return (
    <Link
      to={`/companies/${encodeURIComponent(name)}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div style={styles.card}>
        <div style={styles.header}>
          <h3 style={styles.name}>{name}</h3>
          <span style={styles.count}>{commitments.length} commitment{commitments.length !== 1 ? "s" : ""}</span>
        </div>
        {company?.industry && (
          <span style={styles.industry}>{company.industry.replace(/_/g, " ")}</span>
        )}
        <div style={{ marginTop: "10px" }}>
          <LifecycleBadge phase={worstPhase} />
        </div>
      </div>
    </Link>
  );
}

const styles = {
  card: {
    background: "white",
    padding: "20px",
    borderRadius: "12px",
    marginBottom: "16px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    borderLeft: "4px solid #7d1f5c",
    cursor: "pointer",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "6px",
  },
  name: { margin: 0, color: "#7d1f5c", fontSize: "16px" },
  count: { fontSize: "12px", color: "#888" },
  industry: {
    fontSize: "12px",
    color: "#555",
    background: "#f0f0f0",
    padding: "2px 8px",
    borderRadius: "10px",
    textTransform: "capitalize",
  },
};
