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
  const [refreshing, setRefreshing] = useState(false);
  const [refreshQueued, setRefreshQueued] = useState(false);

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

  async function refreshReport() {
    setRefreshing(true);
    const headers = await authHeaders();
    await fetch(`${API}/org/companies/${companyId}/report/refresh`, { method: "POST", headers });
    setRefreshing(false);
    setRefreshQueued(true);
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
  // Handle direct {"report":"..."} or wrapped {"type":"item","content":"{\"report\":\"...\"}"}
  const reportText = reportJson?.report
    ?? (() => { try { return JSON.parse(reportJson?.content)?.report ?? null; } catch { return null; } })();
  const reportError = reportJson?.type === "error" ? reportJson.content : null;
  const reportPending = saved && !reportText && !reportError;

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <h3 style={styles.panelTitle}>Org Panel</h3>
        <div style={{ display: "flex", gap: "8px" }}>
          {saved && (
            <button
              style={styles.btnRefresh}
              onClick={refreshReport}
              disabled={refreshing || refreshQueued}
            >
              {refreshing ? "Queuing..." : refreshQueued ? "Queued ✓" : "Refresh Report"}
            </button>
          )}
          <button
            style={saved ? styles.btnUnsave : styles.btnSave}
            onClick={toggleSave}
            disabled={saving}
          >
            {saving ? "..." : saved ? "Unsave" : "Save Company"}
          </button>
        </div>
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

      {reportError && (
        <p style={styles.errorBanner}>
          Report generation failed: company may be too large for the AI context window. Try refreshing or use a smaller company.
        </p>
      )}

      {reportText ? (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>OSINT Dossier</h4>
          <ReportMarkdown text={reportText} />
        </div>
      ) : !reportText && saved && (
        REPORT_SECTIONS.map((section) => (
          <ReportSection
            key={section.key}
            title={section.title}
            data={null}
            placeholders={section.placeholders}
            unsaved={false}
          />
        ))
      )}

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

// ─── OSINT report renderer ───────────────────────────────────

const mdLink = { color: "#7d1f5c", textDecoration: "none", fontWeight: "600" };

function urlLabel(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    // take the domain name (second-to-last part), not the subdomain
    const name = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    return name.charAt(0).toUpperCase() + name.slice(1) + " →";
  } catch {
    return "Source →";
  }
}

function renderInline(text, bk) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s,)\]>"]+)/g;
  let last = 0, i = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(<strong key={`${bk}-b${i++}`}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("[")) {
      const lm = tok.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (lm) parts.push(<a key={`${bk}-l${i++}`} href={lm[2]} target="_blank" rel="noreferrer" style={mdLink}>{lm[1]}</a>);
    } else {
      parts.push(<a key={`${bk}-u${i++}`} href={tok} target="_blank" rel="noreferrer" style={mdLink}>{urlLabel(tok)}</a>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// Detect a standalone bold line used as a section header: entire trimmed line is **text**
function isBoldHeader(t) {
  return t.startsWith("**") && t.endsWith("**") && t.length > 4 && !t.slice(2, -2).includes("**");
}

function ReportMarkdown({ text }) {
  const lines = text.split("\n");

  // Pre-pass: identify ALL section headers (markdown + heuristic plain-text)
  // and build a ToC list + section id map simultaneously.
  const sections = []; // { idx, id, label, indent }
  const heuristicSet = new Set();

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    const id = `rms-${i}`;

    if (t.startsWith("# ")) {
      sections.push({ idx: i, id, label: t.slice(2), indent: 0 });
    } else if (t.startsWith("## ") || isBoldHeader(t)) {
      const label = t.startsWith("## ") ? t.slice(3) : t.slice(2, -2);
      sections.push({ idx: i, id, label, indent: 1 });
    } else if (t.startsWith("### ")) {
      sections.push({ idx: i, id, label: t.slice(4), indent: 2 });
    } else {
      // Heuristic: plain-text section header
      if (t.startsWith("#") || /^[-*\d]/.test(t)) continue;
      const prevBlank = i === 0 || !lines[i - 1].trim();
      if (!prevBlank) continue;
      if (t.length < 5 || t.length > 90) continue;
      if (/[.!?,;]$/.test(t)) continue;
      if (!/^[A-Z]/.test(t)) continue;
      if (t.includes("http")) continue;
      let nextOk = false;
      for (let j = i + 1; j < lines.length; j++) {
        const nt = lines[j].trim();
        if (!nt) { nextOk = true; break; }
        if (/^[-*#]/.test(nt) || /^\d+\./.test(nt)) { nextOk = true; break; }
        break;
      }
      if (nextOk) {
        heuristicSet.add(i);
        sections.push({ idx: i, id, label: t, indent: 0 });
      }
    }
  }

  const sectionById = new Map(sections.map(s => [s.idx, s]));

  const toc = sections.length > 1 ? (
    <div style={{ background: "#f7eef5", border: "1px solid #e8d0e0", borderRadius: "8px", padding: "10px 14px", marginBottom: "18px" }}>
      <p style={{ margin: "0 0 6px", fontSize: "10px", fontWeight: "700", color: "#b07090", textTransform: "uppercase", letterSpacing: "0.08em" }}>Contents</p>
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          style={{ display: "block", fontSize: "12px", color: "#7d1f5c", textDecoration: "none", lineHeight: "1.8", paddingLeft: `${s.indent * 12}px`, opacity: 0.85 }}
        >
          {s.label}
        </a>
      ))}
    </div>
  ) : null;

  const els = [];
  let listBuf = [];
  let k = 0;

  function flush() {
    if (!listBuf.length) return;
    const items = listBuf.splice(0);
    els.push(
      <ul key={k++} style={{ margin: "8px 0 18px", paddingLeft: "20px" }}>
        {items}
      </ul>
    );
  }

  lines.forEach((line, idx) => {
    const t = line.trim();
    if (!t) { flush(); return; }
    const sec = sectionById.get(idx);

    if (t.startsWith("# ")) {
      flush();
      els.push(
        <p id={sec?.id} key={k++} style={{ fontWeight: "700", fontSize: "16px", color: "#7d1f5c", margin: "28px 0 8px", borderBottom: "1px solid #f0e0eb", paddingBottom: "6px" }}>
          {renderInline(t.slice(2), k)}
        </p>
      );
    } else if (t.startsWith("## ") || isBoldHeader(t)) {
      flush();
      const label = t.startsWith("## ") ? t.slice(3) : t.slice(2, -2);
      els.push(
        <p id={sec?.id} key={k++} style={{ fontWeight: "700", fontSize: "11px", color: "#b07090", textTransform: "uppercase", letterSpacing: "0.08em", margin: "24px 0 6px" }}>
          {label}
        </p>
      );
    } else if (t.startsWith("### ")) {
      flush();
      els.push(
        <p id={sec?.id} key={k++} style={{ fontWeight: "700", fontSize: "14px", color: "#444", margin: "16px 0 6px" }}>
          {renderInline(t.slice(4), k)}
        </p>
      );
    } else if (heuristicSet.has(idx)) {
      flush();
      els.push(
        <p id={sec?.id} key={k++} style={{ fontWeight: "700", fontSize: "15px", color: "#7d1f5c", margin: "24px 0 6px", borderBottom: "1px solid #f0e0eb", paddingBottom: "4px" }}>
          {renderInline(t, k)}
        </p>
      );
    } else if (/^[-*] /.test(t)) {
      listBuf.push(
        <li key={k++} style={{ fontSize: "13px", color: "#333", lineHeight: "1.7", marginBottom: "5px" }}>
          {renderInline(t.slice(2), k)}
        </li>
      );
    } else if (/^\d+\. /.test(t)) {
      listBuf.push(
        <li key={k++} style={{ fontSize: "13px", color: "#333", lineHeight: "1.7", marginBottom: "5px" }}>
          {renderInline(t.replace(/^\d+\. /, ""), k)}
        </li>
      );
    } else {
      flush();
      els.push(
        <p key={k++} style={{ fontSize: "13px", color: "#444", margin: "0 0 10px", lineHeight: "1.7" }}>
          {renderInline(t, k)}
        </p>
      );
    }
  });
  flush();
  return <div style={{ paddingTop: "4px" }}>{toc}{els}</div>;
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
  errorBanner: {
    fontSize: "12px",
    color: "#b71c1c",
    background: "#fff5f5",
    border: "1px solid #f0c8c8",
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
  btnRefresh: {
    background: "transparent",
    color: "#b07090",
    border: "1px solid #e0c8d8",
    padding: "8px 14px",
    borderRadius: "8px",
    fontSize: "12px",
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
  reportText: {
    fontFamily: "system-ui, sans-serif",
    fontSize: "13px",
    color: "#333",
    lineHeight: "1.7",
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
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
