import { useEffect, useState } from "react";
import CompanyCard from "./CompanyCard";

const PHASE_RANK = { overdue: 4, at_risk: 3, pre_deadline: 2, compliant: 1, unknown: 0 };

function groupByCompany(commitments) {
  return commitments.reduce((acc, c) => {
    const name = c.company?.name;
    if (!name) return acc;
    if (!acc[name]) acc[name] = { company: c.company, commitments: [], worstPhase: "unknown" };
    acc[name].commitments.push(c);
    if ((PHASE_RANK[c.lifecycle_phase] ?? 0) > (PHASE_RANK[acc[name].worstPhase] ?? 0)) {
      acc[name].worstPhase = c.lifecycle_phase;
    }
    return acc;
  }, {});
}

export default function CompanyList() {
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("http://localhost:8000/commitments");
        const data = await res.json();
        setGrouped(groupByCompany(data));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <div style={styles.state}>Loading companies...</div>;

  const entries = Object.entries(grouped).filter(([name]) =>
    name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h2 style={styles.heading}>Brands</h2>
      <input
        style={styles.search}
        placeholder="Search companies..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {entries.length === 0 ? (
        <div style={styles.state}>No companies found.</div>
      ) : (
        entries.map(([name, data]) => (
          <CompanyCard
            key={name}
            name={name}
            company={data.company}
            commitments={data.commitments}
            worstPhase={data.worstPhase}
          />
        ))
      )}
    </div>
  );
}

const styles = {
  heading: { marginBottom: "16px" },
  search: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #e0e0e0",
    fontSize: "14px",
    marginBottom: "16px",
    boxSizing: "border-box",
  },
  state: { color: "#666", padding: "20px 0" },
};
