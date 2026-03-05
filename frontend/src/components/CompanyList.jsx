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

function formatIndustry(slug) {
  return slug.replace(/_and_/g, " & ").replace(/_/g, " ");
}

function getSoonestDeadline(commitments) {
  const dates = commitments.map((c) => c.deadline_date).filter(Boolean);
  return dates.length ? dates.sort()[0] : null;
}

export default function CompanyList() {
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [hideCompliant, setHideCompliant] = useState(true);
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [sortBy, setSortBy] = useState("name");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/commitments`);
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

  const allEntries = Object.entries(grouped).map(([name, data]) => ({
    name,
    ...data,
    soonestDeadline: getSoonestDeadline(data.commitments),
  }));

  const industries = [
    ...new Set(allEntries.map((e) => e.company?.industry).filter(Boolean)),
  ].sort();

  const countries = [
    ...new Set(
      allEntries.flatMap((e) =>
        (e.company?.country || "").split(",").map((c) => c.trim()).filter(Boolean)
      )
    ),
  ].sort();

  let entries = allEntries;
  if (hideCompliant) entries = entries.filter((e) => e.worstPhase !== "compliant");
  if (industry) entries = entries.filter((e) => e.company?.industry === industry);
  if (country) entries = entries.filter((e) =>
    (e.company?.country || "").split(",").map((c) => c.trim()).includes(country)
  );
  if (search) entries = entries.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));

  if (sortBy === "name") {
    entries = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === "deadline") {
    entries = [...entries].sort((a, b) => {
      if (!a.soonestDeadline && !b.soonestDeadline) return 0;
      if (!a.soonestDeadline) return 1;
      if (!b.soonestDeadline) return -1;
      return a.soonestDeadline.localeCompare(b.soonestDeadline);
    });
  } else if (sortBy === "trending") {
    // Proxy: most commitments tracked = most notable company. Replace with engagement tracking later.
    entries = [...entries].sort((a, b) => b.commitments.length - a.commitments.length);
  }

  return (
    <div>
      <h2 style={styles.heading}>Brands</h2>

      <div style={styles.filterRow}>
        <label style={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={hideCompliant}
            onChange={(e) => setHideCompliant(e.target.checked)}
            style={styles.checkbox}
          />
          Hide compliant
        </label>
        <div style={styles.selectGroup}>
          <select
            style={styles.select}
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          >
            <option value="">All industries</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {formatIndustry(ind)}
              </option>
            ))}
          </select>
          {countries.length > 0 && (
            <select
              style={styles.select}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="">All countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          <select
            style={styles.select}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="name">Name A–Z</option>
            <option value="deadline">Soonest deadline</option>
            <option value="trending">Trending</option>
          </select>
        </div>
      </div>

      <input
        style={styles.search}
        placeholder="Search companies..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div style={styles.resultCount}>
        {entries.length} brand{entries.length !== 1 ? "s" : ""}
        {hideCompliant ? " · compliant hidden" : ""}
        {industry ? ` · ${formatIndustry(industry)}` : ""}
        {country ? ` · ${country}` : ""}
      </div>

      {entries.length === 0 ? (
        <div style={styles.state}>No companies found.</div>
      ) : (
        entries.map(({ name, company, commitments, worstPhase }) => (
          <CompanyCard
            key={name}
            name={name}
            company={company}
            commitments={commitments}
            worstPhase={worstPhase}
          />
        ))
      )}
    </div>
  );
}

const styles = {
  heading: { marginBottom: "16px" },
  filterRow: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    marginBottom: "12px",
    flexWrap: "wrap",
  },
  toggleLabel: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    color: "#555",
    cursor: "pointer",
    whiteSpace: "nowrap",
    userSelect: "none",
    flexShrink: 0,
  },
  selectGroup: {
    display: "flex",
    gap: "8px",
    flex: 1,
    minWidth: 0,
    flexWrap: "wrap",
  },
  checkbox: { accentColor: "#7d1f5c", cursor: "pointer" },
  select: {
    flex: "1 1 0",
    minWidth: 0,
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid #e0e0e0",
    fontSize: "13px",
    background: "white",
    color: "#333",
    cursor: "pointer",
    overflow: "hidden",
  },
  search: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #e0e0e0",
    fontSize: "14px",
    marginBottom: "8px",
    boxSizing: "border-box",
  },
  resultCount: {
    fontSize: "12px",
    color: "#999",
    marginBottom: "16px",
  },
  state: { color: "#666", padding: "20px 0" },
};
