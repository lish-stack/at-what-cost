import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import LifecycleBadge from "./LifecycleBadge";

export default function CommitmentDetail() {
  const { id } = useParams();
  const [commitment, setCommitment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`http://localhost:8000/commitments/${id}`);
        if (!res.ok) throw new Error("Commitment not found");
        const data = await res.json();
        setCommitment(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) return <div style={styles.state}>Loading...</div>;
  if (error) return <div style={styles.state}>Error: {error}</div>;

  const daysLabel =
    commitment.days_remaining === null
      ? null
      : commitment.days_remaining >= 0
      ? `${commitment.days_remaining} days remaining`
      : `${Math.abs(commitment.days_remaining)} days overdue`;

  return (
    <div>
      <Link to="/" style={styles.back}>← Back</Link>

      <div style={styles.section}>
        <h2 style={styles.companyName}>{commitment.company?.name}</h2>
        <div style={styles.meta}>
          <span>{commitment.company?.industry}</span>
          {commitment.company?.website && (
            <>
              <span style={styles.dot}>·</span>
              <a href={commitment.company.website} target="_blank" rel="noreferrer" style={styles.link}>
                {commitment.company.website}
              </a>
            </>
          )}
        </div>
        <div style={{ marginTop: "10px" }}>
          <LifecycleBadge phase={commitment.lifecycle_phase} />
          {daysLabel && <span style={styles.daysLabel}>{daysLabel}</span>}
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Commitment</h3>
        <p style={styles.label}>Type</p>
        <p style={styles.value}>{commitment.commitment_type?.replace(/_/g, " ")}</p>
        <p style={styles.label}>Status</p>
        <p style={styles.value}>{commitment.current_status}</p>
        <p style={styles.label}>Deadline</p>
        <p style={styles.value}>{commitment.deadline_date ?? "—"}</p>
        {commitment.announced_date && (
          <>
            <p style={styles.label}>Announced</p>
            <p style={styles.value}>{commitment.announced_date}</p>
          </>
        )}
        {commitment.commitment_text && (
          <>
            <p style={styles.label}>Public Statement</p>
            <p style={styles.value}>{commitment.commitment_text}</p>
          </>
        )}
        {commitment.public_statement_url && (
          <a href={commitment.public_statement_url} target="_blank" rel="noreferrer" style={styles.link}>
            Source →
          </a>
        )}
      </div>

      {commitment.evidence?.length > 0 && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Evidence</h3>
          {commitment.evidence.map((ev) => (
            <div key={ev.id} style={styles.evidenceItem}>
              <span style={styles.tag}>{ev.source_type}</span>
              <p style={styles.evidenceSummary}>{ev.summary}</p>
              {ev.source_url && (
                <a href={ev.source_url} target="_blank" rel="noreferrer" style={styles.link}>
                  View source →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {commitment.compliance_events?.length > 0 && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Timeline</h3>
          {commitment.compliance_events.map((ev) => (
            <div key={ev.id} style={styles.timelineItem}>
              <span style={styles.timelineDate}>{ev.event_date}</span>
              <span style={styles.timelineType}>{ev.event_type?.replace(/_/g, " ")}</span>
              <span style={styles.timelineStatus}>{ev.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  state: { padding: "20px", color: "#666" },
  back: { textDecoration: "none", color: "#7d1f5c", fontWeight: "600" },
  section: { marginTop: "20px", marginBottom: "20px" },
  companyName: { margin: "0 0 6px", color: "#7d1f5c" },
  meta: { fontSize: "14px", color: "#888", display: "flex", gap: "6px", alignItems: "center" },
  dot: { color: "#ccc" },
  link: { color: "#7d1f5c", fontSize: "14px" },
  daysLabel: { marginLeft: "12px", fontSize: "14px", fontWeight: "600", color: "#333" },
  card: {
    background: "white",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "16px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
  },
  cardTitle: { margin: "0 0 16px", color: "#333", fontSize: "16px" },
  label: { fontSize: "12px", color: "#888", margin: "12px 0 2px" },
  value: { fontSize: "14px", color: "#333", margin: 0 },
  evidenceItem: { paddingBottom: "16px", borderBottom: "1px solid #f0f0f0", marginBottom: "16px" },
  evidenceSummary: { fontSize: "14px", color: "#555", margin: "6px 0" },
  tag: {
    background: "#f0f0f0",
    color: "#555",
    fontSize: "11px",
    padding: "2px 8px",
    borderRadius: "10px",
  },
  timelineItem: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid #f0f0f0",
    fontSize: "14px",
  },
  timelineDate: { color: "#888", minWidth: "100px" },
  timelineType: { color: "#333", flex: 1, textTransform: "capitalize" },
  timelineStatus: { color: "#7d1f5c", fontWeight: "600", textTransform: "capitalize" },
};
