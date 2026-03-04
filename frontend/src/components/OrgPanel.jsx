import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const API = "http://localhost:8000";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token}`,
    "Content-Type": "application/json",
  };
}

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

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>OSINT Report</h4>
        {report ? (
          <pre style={styles.report}>{JSON.stringify(report.report_json, null, 2)}</pre>
        ) : (
          <p style={styles.dim}>
            {saved
              ? "Report generation in progress. Check back soon."
              : "Save this company to trigger an OSINT report via Open Paws."}
          </p>
        )}
      </div>

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
    marginBottom: "16px",
  },
  panelTitle: { margin: 0, fontSize: "16px", color: "#7d1f5c" },
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
  section: { marginTop: "16px" },
  sectionTitle: { margin: "0 0 8px", fontSize: "13px", color: "#555", fontWeight: "600" },
  dim: { fontSize: "13px", color: "#999", margin: 0 },
  report: {
    background: "#f5f5f5",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "12px",
    overflow: "auto",
    maxHeight: "300px",
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
