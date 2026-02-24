import { useEffect, useState } from "react";
import CommitmentCard from "./CommitmentCard";

export default function CommitmentList() {
  const [commitments, setCommitments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Replace with your backend endpoint later
    async function fetchData() {
      try {
        // const res = await fetch("http://localhost:8000/commitments");
        // const data = await res.json();

        // Temporary mock data
        const data = [
          {
            id: 1,
            company: "Ahold Delhaize",
            commitment_type: "cage_free_eggs",
            deadline_date: "2026-12-31",
            current_status: "unknown",
          },
          {
            id: 2,
            company: "Walmart",
            commitment_type: "cage_free_eggs",
            deadline_date: "2025-06-01",
            current_status: "unknown",
          },
        ];

        setCommitments(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) return <div>Loading commitments...</div>;

  return (
    <div>
      <h2 style={{ marginBottom: "20px" }}>Active Commitments</h2>
      {commitments.map((c) => (
        <CommitmentCard key={c.id} commitment={c} />
      ))}
    </div>
  );
}