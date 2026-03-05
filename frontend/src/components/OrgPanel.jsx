import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const API = import.meta.env.VITE_API_URL;

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token}`,
    "Content-Type": "application/json",
  };
}

const REPORT_SECTIONS = [
  {
    key: "commitment_compliance",
    title: "Commitment & Compliance",
    placeholders: [
      "ESG / CSR disclosures",
      "AGM outcomes",
      "Progress in other markets",
      "Cage-free milestones by region",
    ],
  },
  {
    key: "company_structure",
    title: "Company Structure",
    placeholders: [
      "Leadership profiles",
      "Corporate hierarchy",
      "Board memberships & affiliations",
      "Franchising structure & key partners",
    ],
  },
  {
    key: "signals_triggers",
    title: "Signals & Triggers",
    placeholders: [
      "Recent news mentions",
      "Financial report activity",
      "Social media changes",
    ],
  },
  {
    key: "people",
    title: "People to Target",
    placeholders: [
      "Decision-maker contacts",
      "Executive public statements",
      "Brand ambassadors",
      "Internal advocates",
    ],
  },
  {
    key: "legal_legislative",
    title: "Legal & Legislative",
    placeholders: [
      "Court cases (CourtListener)",
      "Related legislation (LegiScan)",
      "Government documents (DocumentCloud)",
    ],
  },
];

export default function OrgPanel({ companyId }) {
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const headers = await authHeaders();
      const [savedRes, notesRes, reportRes] = await Promise.all([
        fetch(`${API}/org/saved-companies`, { headers }),
        fetch(`${API}/org/companies/${companyId}/notes`, { headers }),
        fetch(`${API}/org/companies/${companyId}/report`, { headers }),
      ]);

      if (savedRes.ok) {
        const savedData = await savedRes.json();
        setSaved(savedData.some((s) => s.companies?.id === companyId));
      }
      if (notesRes.ok) {
        const notesData = await notesRes.json();
        setNotes(notesData.notes ?? "");
      }
      if (reportRes.ok) {
        setReport(await reportRes.json());
      }
      setLoading(false);
    }
    if (companyId) load();
  }, [companyId]);

  async function toggleSave() {
    setSaving(true);
    const headers = await authHeaders();
    if (saved) {
      await fetch(`${API}/org/saved-companies/${companyId}`, { method: "DELETE", headers });
      setSaved(false);
    } else {
      await fetch(`${API}/org/saved-companies/${companyId}`, { method: "POST", headers });
      setSaved(true);
    }
    setSaving(false);
  }

  async function saveNotes() {
    const headers = await authHeaders();
    await fetch(`${API}/org/companies/${companyId}/notes`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ notes }),
    });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  if (loading) return <div style={styles.panel}><p style={styles.dim}>Loading org data...</p></div>;

  const reportJson = report?.report_json ?? null;
  const reportPending = saved && !reportJson;

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <h3 style={styles.panelTitle}>Org Panel</h3>
        <button
          style={saved ? styles.btnUnsave : styles.btnSave}
          onClick={toggleSave}
          disabled={saving}
        >
          {saving ? "..." : saved ? "Unsave" : "Save Company"}
        </button>
      </div>

      {!saved && (
        <p style={styles.savePrompt}>
          Save this company to generate an OSINT dossier via Open Paws.
        </p>
      )}

      {reportPending && (
        <p style={styles.pendingBanner}>
          Report generation in progress — check back soon.
        </p>
      )}

      {REPORT_SECTIONS.map((section) => (
        <ReportSection
          key={section.key}
          title={section.title}
          data={reportJson?.[section.key]}
          placeholders={section.placeholders}
          unsaved={!saved}
        />
      ))}

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Internal Notes</h4>
        <textarea
          style={styles.textarea}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add internal notes about this company..."
          rows={4}
        />
        <button style={styles.btnNotes} onClick={saveNotes}>
          {notesSaved ? "Saved ✓" : "Save Notes"}
        </button>
      </div>
    </div>
  );
}

function ReportSection({ title, data, placeholders, unsaved }) {
  return (
    <div style={styles.section}>
      <h4 style={styles.sectionTitle}>{title}</h4>
      {data ? (
        <SectionData data={data} />
      ) : (
        <div style={styles.skeletonList}>
          {placeholders.map((p) => (
            <div key={p} style={styles.skeletonRow}>
              <span style={styles.skeletonDot} />
              <span style={unsaved ? styles.skeletonTextUnsaved : styles.skeletonText}>{p}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionData({ data }) {
  if (typeof data === "string") {
    return <p style={styles.sectionText}>{data}</p>;
  }
  if (Array.isArray(data)) {
    return (
      <ul style={styles.dataList}>
        {data.map((item, i) => (
          <li key={i} style={styles.dataItem}>
            {typeof item === "object" ? (
              <pre style={styles.dataJson}>{JSON.stringify(item, null, 2)}</pre>
            ) : String(item)}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof data === "object") {
    return (
      <dl style={styles.dataDict}>
        {Object.entries(data).map(([k, v]) => (
          <div key={k} style={styles.dataDictRow}>
            <dt style={styles.dataDictKey}>{k.replace(/_/g, " ")}</dt>
            <dd style={styles.dataDictVal}>
              {typeof v === "object" ? JSON.stringify(v) : String(v)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <p style={styles.sectionText}>{String(data)}</p>;
}

const styles = {
  panel: {
    background: "#fdf6fb",
    border: "1px solid #e8d0e0",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "16px",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  panelTitle: { margin: 0, fontSize: "16px", color: "#7d1f5c" },
  savePrompt: {
    fontSize: "13px",
    color: "#bbb",
    margin: "0 0 4px",
    fontStyle: "italic",
  },
  pendingBanner: {
    fontSize: "12px",
    color: "#a0736d",
    background: "#fff5f0",
    border: "1px solid #f0d0c8",
    borderRadius: "6px",
    padding: "8px 12px",
    margin: "8px 0 0",
  },
  btnSave: {
    background: "#7d1f5c",
    color: "white",
    border: "none",
    padding: "8px 16px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  btnUnsave: {
    background: "white",
    color: "#7d1f5c",
    border: "1px solid #7d1f5c",
    padding: "8px 16px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  section: {
    marginTop: "16px",
    borderTop: "1px solid #f0e0eb",
    paddingTop: "14px",
  },
  sectionTitle: {
    margin: "0 0 8px",
    fontSize: "11px",
    color: "#b07090",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  dim: { fontSize: "13px", color: "#bbb", margin: 0 },
  skeletonList: { display: "flex", flexDirection: "column", gap: "5px" },
  skeletonRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  skeletonDot: {
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    background: "#e0c8d8",
    flexShrink: 0,
  },
  skeletonText: { fontSize: "13px", color: "#c8a8bc" },
  skeletonTextUnsaved: { fontSize: "13px", color: "#ddd" },
  sectionText: { fontSize: "13px", color: "#444", margin: 0, lineHeight: "1.6" },
  dataList: {
    margin: 0,
    padding: "0 0 0 16px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  dataItem: { fontSize: "13px", color: "#444", lineHeight: "1.5" },
  dataDict: { margin: 0, display: "flex", flexDirection: "column", gap: "6px" },
  dataDictRow: { display: "flex", gap: "10px", alignItems: "baseline" },
  dataDictKey: {
    fontSize: "11px",
    color: "#999",
    fontWeight: "600",
    textTransform: "capitalize",
    minWidth: "130px",
    flexShrink: 0,
  },
  dataDictVal: { fontSize: "13px", color: "#444", margin: 0 },
  dataJson: {
    background: "#f5f5f5",
    borderRadius: "6px",
    padding: "8px",
    fontSize: "11px",
    overflow: "auto",
    margin: "4px 0 0",
  },
  textarea: {
    width: "100%",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #e0e0e0",
    fontSize: "14px",
    boxSizing: "border-box",
    resize: "vertical",
    fontFamily: "system-ui, sans-serif",
  },
  btnNotes: {
    marginTop: "8px",
    background: "#7d1f5c",
    color: "white",
    border: "none",
    padding: "8px 16px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
};
