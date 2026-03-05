import { useEffect, useState } from "react";
import CommitmentCard from "./CommitmentCard";

export default function CommitmentList() {
  const [commitments, setCommitments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/commitments`);
        const data = await res.json();
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