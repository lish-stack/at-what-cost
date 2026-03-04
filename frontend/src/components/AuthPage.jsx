import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (mode === "login") {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
      else navigate("/");
    } else {
      const { error } = await signUp(email, password);
      if (error) setError(error.message);
      else setMessage("Check your email to confirm your account.");
    }

    setLoading(false);
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h2 style={styles.title}>
          {mode === "login" ? "Sign In" : "Create Account"}
        </h2>

        <form onSubmit={handleSubmit}>
          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <div style={styles.error}>{error}</div>}
          {message && <div style={styles.success}>{message}</div>}

          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? "Loading..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div style={styles.toggle}>
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <span style={styles.link} onClick={() => setMode("signup")}>
                Sign up
              </span>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <span style={styles.link} onClick={() => setMode("login")}>
                Sign in
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    justifyContent: "center",
    paddingTop: "60px",
  },
  card: {
    background: "white",
    borderRadius: "12px",
    padding: "32px",
    width: "100%",
    maxWidth: "400px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  title: {
    margin: "0 0 24px",
    color: "#7d1f5c",
    fontSize: "20px",
  },
  input: {
    display: "block",
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #e0e0e0",
    fontSize: "14px",
    marginBottom: "12px",
    boxSizing: "border-box",
  },
  btn: {
    width: "100%",
    padding: "12px",
    background: "#7d1f5c",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    marginTop: "4px",
  },
  error: {
    color: "#b71c1c",
    fontSize: "13px",
    marginBottom: "12px",
  },
  success: {
    color: "#2e7d32",
    fontSize: "13px",
    marginBottom: "12px",
  },
  toggle: {
    marginTop: "20px",
    fontSize: "13px",
    color: "#666",
    textAlign: "center",
  },
  link: {
    color: "#7d1f5c",
    cursor: "pointer",
    fontWeight: "600",
  },
};
