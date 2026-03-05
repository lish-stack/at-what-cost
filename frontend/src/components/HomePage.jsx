import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import CommitmentCard from "./CommitmentCard";

const PHASE_RANK = { overdue: 4, at_risk: 3, pre_deadline: 2, compliant: 1, unknown: 0 };

function computeStats(list) {
  const companies = new Set(list.map((c) => c.company?.name).filter(Boolean));
  const compliant = list.filter((c) => c.lifecycle_phase === "compliant").length;
  return {
    companies: companies.size,
    total: list.length,
    pctCompliant: list.length ? Math.round((compliant / list.length) * 100) : 0,
  };
}

function getUrgent(list) {
  return list
    .filter((c) => c.lifecycle_phase === "overdue" || c.lifecycle_phase === "at_risk")
    .sort((a, b) => (PHASE_RANK[b.lifecycle_phase] ?? 0) - (PHASE_RANK[a.lifecycle_phase] ?? 0))
    .slice(0, 6);
}

function getSpotlight(list) {
  const grouped = list.reduce((acc, c) => {
    const name = c.company?.name;
    if (!name) return acc;
    if (!acc[name]) acc[name] = { company: c.company, worstRank: 0, latestDeadline: null };
    const rank = PHASE_RANK[c.lifecycle_phase] ?? 0;
    if (rank > acc[name].worstRank) acc[name].worstRank = rank;
    if (c.deadline_date && (!acc[name].latestDeadline || c.deadline_date > acc[name].latestDeadline)) {
      acc[name].latestDeadline = c.deadline_date;
    }
    return acc;
  }, {});

  return Object.entries(grouped)
    .filter(([, d]) => d.worstRank === PHASE_RANK.compliant)
    .map(([name, d]) => ({ name, company: d.company, latestDeadline: d.latestDeadline }))
    .sort((a, b) => (b.latestDeadline ?? "").localeCompare(a.latestDeadline ?? ""));
}

export default function HomePage() {
  const { user, role } = useAuth();
  const [commitments, setCommitments] = useState([]);
  const [savedIds, setSavedIds] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/commitments`);
        const data = await res.json();
        setCommitments(data);

        if (role === "org" && user) {
          const { data: { session } } = await supabase.auth.getSession();
          const savedRes = await fetch(`${import.meta.env.VITE_API_URL}/org/saved-companies`, {
            headers: { Authorization: `Bearer ${session?.access_token}` },
          });
          const savedData = await savedRes.json();
          setSavedIds(new Set(savedData.map((d) => d.companies?.id).filter(Boolean)));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [role, user]);

  if (loading) return <div style={styles.state}>Loading...</div>;

  const isOrg = role === "org";
  const hasSaved = savedIds?.size > 0;
  const displayed = isOrg && hasSaved
    ? commitments.filter((c) => savedIds.has(c.company_id))
    : commitments;

  const stats = computeStats(displayed);
  const urgent = getUrgent(displayed);
  const spotlight = getSpotlight(displayed);

  return (
    <div>
      {isOrg && (
        <div style={hasSaved ? styles.orgBanner : styles.orgBannerEmpty}>
          {hasSaved ? (
            <>
              Scoped to your {savedIds.size} saved brand{savedIds.size !== 1 ? "s" : ""} ·{" "}
              <Link to="/companies" style={styles.bannerLink}>Browse all</Link>
            </>
          ) : (
            <>
              Save brands to see your personalized view ·{" "}
              <Link to="/companies" style={styles.bannerLink}>Browse brands</Link>
            </>
          )}
        </div>
      )}

      <div style={styles.statsRow}>
        <StatCard value={stats.companies} label="Brands Tracked" />
        <StatCard value={stats.total} label="Commitments" />
        <StatCard value={`${stats.pctCompliant}%`} label="Compliant" highlight />
      </div>

      <section>
        <h3 style={styles.sectionHeading}>Urgent Actions</h3>
        {urgent.length === 0 ? (
          <p style={styles.empty}>No overdue or at-risk commitments.</p>
        ) : (
          urgent.map((c) => <CommitmentCard key={c.id} commitment={c} />)
        )}
      </section>

      <section style={{ marginTop: "28px" }}>
        <h3 style={styles.sectionHeading}>Keeping Their Word</h3>
        {spotlight.length === 0 ? (
          <p style={styles.empty}>No fully compliant companies yet.</p>
        ) : (
          <div style={styles.spotlightGrid}>
            {spotlight.map(({ name, company }) => (
              <Link key={name} to={`/companies/${encodeURIComponent(name)}`} style={styles.spotlightLink}>
                <div style={styles.spotlightCard}>
                  <div style={styles.spotlightCheck}>✓</div>
                  <div style={styles.spotlightName}>{name}</div>
                  {company?.industry && (
                    <div style={styles.spotlightIndustry}>{company.industry.replace(/_/g, " ")}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ value, label, highlight }) {
  return (
    <div style={{ ...styles.statCard, ...(highlight ? styles.statHighlight : {}) }}>
      <div style={{ ...styles.statValue, ...(highlight ? { color: "white" } : {}) }}>{value}</div>
      <div style={{ ...styles.statLabel, ...(highlight ? { color: "rgba(255,255,255,0.75)" } : {}) }}>{label}</div>
    </div>
  );
}

const styles = {
  state: { padding: "20px", color: "#666" },
  orgBanner: {
    background: "#f8f0f5",
    border: "1px solid #e8d5e8",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    color: "#555",
    marginBottom: "20px",
  },
  orgBannerEmpty: {
    background: "#fafafa",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    color: "#888",
    marginBottom: "20px",
  },
  bannerLink: { color: "#7d1f5c", fontWeight: "600", textDecoration: "none" },
  statsRow: { display: "flex", gap: "12px", marginBottom: "28px" },
  statCard: {
    flex: 1,
    background: "white",
    borderRadius: "12px",
    padding: "16px",
    textAlign: "center",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
  },
  statHighlight: { background: "#7d1f5c" },
  statValue: { fontSize: "28px", fontWeight: "700", color: "#7d1f5c" },
  statLabel: { fontSize: "12px", color: "#888", marginTop: "4px" },
  sectionHeading: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "12px",
  },
  empty: { color: "#999", fontSize: "14px", padding: "8px 0" },
  spotlightGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: "12px",
  },
  spotlightLink: { textDecoration: "none" },
  spotlightCard: {
    background: "white",
    borderRadius: "12px",
    padding: "16px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    border: "1px solid #e8f5e9",
  },
  spotlightCheck: { color: "#4caf50", fontWeight: "700", fontSize: "18px", marginBottom: "8px" },
  spotlightName: { fontWeight: "600", color: "#333", fontSize: "14px", marginBottom: "4px" },
  spotlightIndustry: { fontSize: "11px", color: "#999", textTransform: "capitalize" },
};
