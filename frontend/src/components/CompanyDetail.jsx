import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import CommitmentCard from "./CommitmentCard";
import OrgPanel from "./OrgPanel";
import { useAuth } from "../context/AuthContext";

export default function CompanyDetail() {
  const { name } = useParams();
  const decodedName = decodeURIComponent(name);
  const { role } = useAuth();

  const [commitments, setCommitments] = useState([]);
  const [company, setCompany] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/commitments`);
        if (!res.ok) throw new Error("Failed to load commitments");
        const data = await res.json();
        const filtered = data.filter((c) => c.company?.name === decodedName);
        if (filtered.length === 0) throw new Error("Company not found");
        setCompany(filtered[0].company);
        setCompanyId(filtered[0].company_id);
        setCommitments(filtered);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [decodedName]);

  if (loading) return <div style={styles.state}>Loading...</div>;
  if (error) return <div style={styles.state}>Error: {error}</div>;

  return (
    <div>
      <Link to="/companies" style={styles.back}>← Brands</Link>

      <div style={styles.header}>
        <h2 style={styles.name}>{decodedName}</h2>
        <div style={styles.meta}>
          {company?.industry && (
            <span style={styles.industry}>{company.industry.replace(/_/g, " ")}</span>
          )}
          {company?.website && (
            <a href={company.website} target="_blank" rel="noreferrer" style={styles.link}>
              {company.website}
            </a>
          )}
        </div>
      </div>

      {role === "org" && companyId && <OrgPanel companyId={companyId} />}

      <h3 style={styles.subheading}>
        {commitments.length} Commitment{commitments.length !== 1 ? "s" : ""}
      </h3>

      {commitments.map((c) => (
        <CommitmentCard key={c.id} commitment={c} />
      ))}
    </div>
  );
}

const styles = {
  state: { color: "#666", padding: "20px 0" },
  back: { textDecoration: "none", color: "#7d1f5c", fontWeight: "600" },
  header: { margin: "20px 0 16px" },
  name: { margin: "0 0 8px", color: "#7d1f5c" },
  meta: { display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" },
  industry: {
    fontSize: "12px",
    color: "#555",
    background: "#f0f0f0",
    padding: "2px 8px",
    borderRadius: "10px",
    textTransform: "capitalize",
  },
  link: { color: "#7d1f5c", fontSize: "14px" },
  subheading: { fontSize: "14px", color: "#888", fontWeight: "600", marginBottom: "12px" },
};
