import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;

export default function TakeAction({ commitment }) {
  const [campaigns, setCampaigns] = useState(null); // null = loading
  const [script, setScript] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!commitment?.company_id) return;
    fetch(`${API}/companies/${commitment.company_id}/campaigns`)
      .then((r) => r.json())
      .then(setCampaigns)
      .catch(() => setCampaigns([]));
  }, [commitment?.company_id]);

  async function generateScript(type) {
    setGenerating(type);
    try {
      const res = await fetch(`${API}/commitments/${commitment.id}/action-script?type=${type}`, {
        method: "POST",
      });
      const data = await res.json();
      setScript(data);
    } catch {
      setScript({ error: true });
    } finally {
      setGenerating(false);
    }
  }

  function handleCopy() {
    if (!script?.script_text) return;
    navigator.clipboard.writeText(script.script_text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (campaigns === null) return null; // loading silently

  const hasCampaigns = campaigns.length > 0;

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>Take Action</h3>

      {hasCampaigns ? (
        <>
          <p style={styles.subtitle}>
            {campaigns.length} organization{campaigns.length !== 1 ? "s are" : " is"} running
            campaigns right now. Each takes ~2 minutes.
          </p>
          {campaigns.map((c) => (
            <div key={c.id} style={styles.campaignRow}>
              <div>
                <div style={styles.orgName}>{c.org_name}</div>
                {c.campaign_title && <div style={styles.campaignTitle}>{c.campaign_title}</div>}
              </div>
              <a
                href={c.campaign_url}
                target="_blank"
                rel="noreferrer"
                style={styles.actionBtn}
              >
                Take Action →
              </a>
            </div>
          ))}
        </>
      ) : (
        <>
          <p style={styles.subtitle}>
            No active campaigns found. Generate a script to contact {commitment.company?.name} directly.
          </p>

          {!script && (
            <div style={styles.btnRow}>
              <button
                style={generating === "email" ? styles.btnLoading : styles.btn}
                onClick={() => generateScript("email")}
                disabled={!!generating}
              >
                {generating === "email" ? "Generating..." : "Email Script"}
              </button>
              <button
                style={generating === "phone" ? styles.btnLoading : styles.btnOutline}
                onClick={() => generateScript("phone")}
                disabled={!!generating}
              >
                {generating === "phone" ? "Generating..." : "Phone Script"}
              </button>
            </div>
          )}

          {script?.error && (
            <p style={styles.errorMsg}>Could not generate script. Please try again.</p>
          )}

          {script?.script_text && (
            <div style={styles.scriptBlock}>
              <div style={styles.scriptHeader}>
                <span style={styles.scriptTypeLabel}>
                  {script.script_type === "email" ? "Email Script" : "Phone Script"}
                </span>
                <button style={styles.copyBtn} onClick={handleCopy}>
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre style={styles.scriptText}>{script.script_text}</pre>
              {script.script_type === "email" && (
                <button
                  style={styles.altBtn}
                  onClick={() => { setScript(null); generateScript("phone"); }}
                  disabled={!!generating}
                >
                  {generating === "phone" ? "Generating..." : "Generate Phone Version Instead"}
                </button>
              )}
              {script.script_type === "phone" && (
                <button
                  style={styles.altBtn}
                  onClick={() => { setScript(null); generateScript("email"); }}
                  disabled={!!generating}
                >
                  {generating === "email" ? "Generating..." : "Generate Email Version Instead"}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: "white",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "16px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    borderLeft: "3px solid #7d1f5c",
  },
  title: { margin: "0 0 6px", color: "#7d1f5c", fontSize: "16px" },
  subtitle: { fontSize: "13px", color: "#666", margin: "0 0 16px" },
  campaignRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 0",
    borderBottom: "1px solid #f0f0f0",
    gap: "12px",
  },
  orgName: { fontWeight: "600", fontSize: "14px", color: "#333" },
  campaignTitle: { fontSize: "12px", color: "#888", marginTop: "2px" },
  actionBtn: {
    background: "#7d1f5c",
    color: "white",
    padding: "8px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    textDecoration: "none",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  btnRow: { display: "flex", gap: "10px", marginBottom: "16px" },
  btn: {
    background: "#7d1f5c",
    color: "white",
    border: "none",
    padding: "10px 18px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  btnOutline: {
    background: "transparent",
    color: "#7d1f5c",
    border: "1px solid #7d1f5c",
    padding: "10px 18px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  btnLoading: {
    background: "#ccc",
    color: "white",
    border: "none",
    padding: "10px 18px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "not-allowed",
  },
  errorMsg: { color: "#b71c1c", fontSize: "13px" },
  scriptBlock: {
    background: "#fafafa",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "16px",
  },
  scriptHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  scriptTypeLabel: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  copyBtn: {
    background: "#7d1f5c",
    color: "white",
    border: "none",
    padding: "4px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },
  scriptText: {
    fontFamily: "inherit",
    fontSize: "13px",
    color: "#333",
    lineHeight: "1.6",
    margin: "0 0 12px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  altBtn: {
    background: "transparent",
    color: "#7d1f5c",
    border: "none",
    fontSize: "12px",
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
  },
};
