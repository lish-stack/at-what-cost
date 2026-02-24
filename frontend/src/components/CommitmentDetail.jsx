import { useParams, Link } from "react-router-dom";

export default function CommitmentDetail() {
  const { id } = useParams();

  // Replace with real fetch later
  const commitment = {
    id,
    company: "Ahold Delhaize",
    commitment_type: "cage_free_eggs",
    deadline_date: "2026-12-31",
    current_status: "unknown",
    commitment_text:
      "Company committed to transition to 100% cage-free eggs by deadline.",
  };

  return (
    <div>
      <Link to="/" style={{ textDecoration: "none" }}>
        ← Back
      </Link>

      <h2 style={{ marginTop: "20px", color: "#7d1f5c" }}>
        {commitment.company}
      </h2>

      <p>
        <strong>Commitment Type:</strong>{" "}
        {commitment.commitment_type}
      </p>

      <p>
        <strong>Deadline:</strong> {commitment.deadline_date}
      </p>

      <p>
        <strong>Status:</strong> {commitment.current_status}
      </p>

      <div style={{ marginTop: "20px" }}>
        <strong>Public Commitment:</strong>
        <p>{commitment.commitment_text}</p>
      </div>
    </div>
  );
}