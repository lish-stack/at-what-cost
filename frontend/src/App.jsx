import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import HomePage from "./components/HomePage";
import CommitmentDetail from "./components/CommitmentDetail";
import CompanyList from "./components/CompanyList";
import CompanyDetail from "./components/CompanyDetail";
import AuthPage from "./components/AuthPage";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div style={styles.app}>
          <NavBar />
          <div style={styles.container}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/commitments/:id" element={<CommitmentDetail />} />
              <Route path="/companies" element={<CompanyList />} />
              <Route path="/companies/:name" element={<CompanyDetail />} />
              <Route path="/auth" element={<AuthPage />} />
            </Routes>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

function NavBar() {
  const { user, role, signOut, loading } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <div style={styles.nav}>
      <Link to="/" style={styles.logo}>At What Cost</Link>
      <div style={styles.navLinks}>
        <Link to="/" style={styles.navLink}>Home</Link>
        <Link to="/companies" style={styles.navLink}>Brands</Link>
      </div>
      <div style={styles.authArea}>
        {!loading && (
          user ? (
            <>
              {role === "org" && <span style={styles.orgBadge}>Org</span>}
              <span style={styles.userEmail}>{user.email}</span>
              <button style={styles.authBtn} onClick={handleSignOut}>Sign Out</button>
            </>
          ) : (
            <Link to="/auth" style={styles.authBtn}>Sign In</Link>
          )
        )}
      </div>
    </div>
  );
}

const styles = {
  app: {
    fontFamily: "system-ui, sans-serif",
    background: "#f5f5f5",
    minHeight: "100vh",
  },
  nav: {
    background: "#7d1f5c",
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    gap: "24px",
  },
  logo: {
    color: "white",
    textDecoration: "none",
    fontWeight: "600",
    fontSize: "18px",
    marginRight: "8px",
  },
  navLinks: {
    display: "flex",
    gap: "20px",
    flex: 1,
  },
  navLink: {
    color: "rgba(255,255,255,0.85)",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: "500",
  },
  authArea: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  orgBadge: {
    background: "rgba(255,255,255,0.2)",
    color: "white",
    fontSize: "11px",
    fontWeight: "700",
    padding: "2px 8px",
    borderRadius: "10px",
    letterSpacing: "0.05em",
  },
  userEmail: {
    color: "rgba(255,255,255,0.75)",
    fontSize: "13px",
  },
  authBtn: {
    background: "rgba(255,255,255,0.15)",
    color: "white",
    border: "1px solid rgba(255,255,255,0.3)",
    padding: "6px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    textDecoration: "none",
  },
  container: {
    maxWidth: "700px",
    margin: "0 auto",
    padding: "20px",
  },
};
