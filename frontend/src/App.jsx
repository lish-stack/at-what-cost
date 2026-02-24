import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import CommitmentList from "./components/CommitmentList";
import CommitmentDetail from "./components/CommitmentDetail";

export default function App() {
  return (
    <Router>
      <div style={styles.app}>
        <NavBar />
        <div style={styles.container}>
          <Routes>
            <Route path="/" element={<CommitmentList />} />
            <Route path="/commitments/:id" element={<CommitmentDetail />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

function NavBar() {
  return (
    <div style={styles.nav}>
      <Link to="/" style={styles.logo}>
        At What Cost
      </Link>
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
    padding: "16px",
    color: "white",
    fontWeight: "600",
    fontSize: "18px",
  },
  logo: {
    color: "white",
    textDecoration: "none",
  },
  container: {
    maxWidth: "700px",
    margin: "0 auto",
    padding: "20px",
  },
};