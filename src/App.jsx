import { useState, useEffect, useCallback, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue } from "firebase/database";

// ─── FIREBASE ────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBhZ6z16gT9LHaUOtws_8q98XfnWhZcImU",
  authDomain: "fcks-voting.firebaseapp.com",
  projectId: "fcks-voting",
  storageBucket: "fcks-voting.firebasestorage.app",
  messagingSenderId: "401986843234",
  appId: "1:401986843234:web:c5a9d5a33b0a2d111d573b",
  databaseURL: "https://fcks-voting-default-rtdb.firebaseio.com",
};
const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ─── DB HELPERS ──────────────────────────────────────────────────────────────
async function dbGet(path) {
  const snap = await get(ref(db, path));
  return snap.exists() ? snap.val() : null;
}
async function dbSet(path, val) {
  await set(ref(db, path), val);
}

async function getVotes()  { const v = await dbGet("votes");  return v || { a: 0, b: 0 }; }
async function setVotes(v) { await dbSet("votes", v); }
async function getActive() { return (await dbGet("active")) === true; }
async function setActive(v){ await dbSet("active", v); }
async function getResetToken() { return await dbGet("resetToken"); }
async function setResetToken(t){ await dbSet("resetToken", t); }

// ─── LOCAL VOTE (per device) ──────────────────────────────────────────────────
const LK_VOTED = "fcks-my-vote";
const LK_RESET = "fcks-my-reset";
function localGetVote()  { return localStorage.getItem(LK_VOTED); }
function localGetReset() { return localStorage.getItem(LK_RESET); }
function localSaveVote(id, token) {
  localStorage.setItem(LK_VOTED, id);
  localStorage.setItem(LK_RESET, String(token));
}
function localClearVote() {
  localStorage.removeItem(LK_VOTED);
  localStorage.removeItem(LK_RESET);
}

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const PRESENTER_USER = "fcks";
const PRESENTER_PASS = "news2025";
const CANDIDATE_A = { id: "a", name: "Camilo Sánchez", color: "#2563eb" };
const CANDIDATE_B = { id: "b", name: "Camilo Pardo",   color: "#dc2626" };

function pct(val, total) { return total === 0 ? 50 : Math.round((val / total) * 100); }

// ─── LOGIN ───────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [user, setUser]   = useState("");
  const [pass, setPass]   = useState("");
  const [err,  setErr]    = useState(false);
  const [shake,setShake]  = useState(false);

  const attempt = () => {
    if (user === PRESENTER_USER && pass === PRESENTER_PASS) {
      onLogin();
    } else {
      setErr(true); setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div style={s.page}>
      <div style={{ ...s.card, maxWidth: 360, ...(shake ? s.shake : {}) }}>
        <div style={s.logo}>F*cks News</div>
        <div style={s.loginTitle}>Acceso Presentador</div>
        <div style={s.field}>
          <label style={s.label}>Usuario</label>
          <input style={{ ...s.input, borderColor: err ? "#ef4444" : "#334155" }}
            value={user} onChange={e => { setUser(e.target.value); setErr(false); }}
            onKeyDown={e => e.key === "Enter" && attempt()}
            autoComplete="username" spellCheck={false} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Contraseña</label>
          <input style={{ ...s.input, borderColor: err ? "#ef4444" : "#334155" }}
            type="password" value={pass}
            onChange={e => { setPass(e.target.value); setErr(false); }}
            onKeyDown={e => e.key === "Enter" && attempt()}
            autoComplete="current-password" />
        </div>
        {err && <div style={s.errMsg}>Usuario o contraseña incorrectos</div>}
        <button style={s.loginBtn} onClick={attempt}>Ingresar</button>
      </div>
    </div>
  );
}

// ─── PRESENTER DASHBOARD ─────────────────────────────────────────────────────
function PresenterDashboard({ onLogout }) {
  const [votes,  setVotesState] = useState({ a: 0, b: 0 });
  const [active, setActiveState] = useState(false);
  const [pulse,  setPulse]  = useState(false);
  const prevRef = useRef({ a: 0, b: 0 });

  // Real-time listeners
  useEffect(() => {
    const unsubVotes = onValue(ref(db, "votes"), snap => {
      const v = snap.exists() ? snap.val() : { a: 0, b: 0 };
      if (v.a !== prevRef.current.a || v.b !== prevRef.current.b) {
        setPulse(true);
        setTimeout(() => setPulse(false), 700);
        prevRef.current = v;
      }
      setVotesState(v);
    });
    const unsubActive = onValue(ref(db, "active"), snap => {
      setActiveState(snap.exists() ? snap.val() : false);
    });
    return () => { unsubVotes(); unsubActive(); };
  }, []);

  const toggleActive = async () => {
    await setActive(!active);
  };

  const resetAll = async () => {
    const token = Date.now();
    await setVotes({ a: 0, b: 0 });
    await setResetToken(token);
    await setActive(false);
  };

  const total = votes.a + votes.b;
  const pA = pct(votes.a, total);
  const pB = pct(votes.b, total);
  const leading = votes.a > votes.b ? "a" : votes.b > votes.a ? "b" : null;

  return (
    <div style={s.page}>
      <div style={{ ...s.card, maxWidth: 560 }}>
        <div style={s.dashHeader}>
          <div>
            <div style={s.logo}>F*cks News</div>
            <div style={s.dashSub}>Panel del Presentador</div>
          </div>
          <button style={s.logoutBtn} onClick={onLogout}>Salir</button>
        </div>

        <div style={{ ...s.statusPill, background: active ? "#14532d" : "#1c1917", borderColor: active ? "#22c55e" : "#44403c" }}>
          <div style={{ ...s.statusDot, background: active ? "#22c55e" : "#78716c", boxShadow: active ? "0 0 8px #22c55e" : "none" }} />
          <span style={{ color: active ? "#86efac" : "#a8a29e", fontWeight: 700, fontSize: 13, letterSpacing: "0.1em" }}>
            {active ? "VOTACIÓN ACTIVA" : "VOTACIÓN CERRADA"}
          </span>
        </div>

        <div style={{ ...s.totalWrap, transform: pulse ? "scale(1.05)" : "scale(1)", transition: "transform 0.3s" }}>
          <span style={s.totalNum}>{total.toLocaleString()}</span>
          <span style={s.totalLabel}>votos registrados</span>
        </div>

        <div style={s.barsWrap}>
          <Bar candidate={CANDIDATE_A} votes={votes.a} pct={pA} leading={leading === "a"} />
          <div style={s.vsLine}><span style={s.vs}>VS</span></div>
          <Bar candidate={CANDIDATE_B} votes={votes.b} pct={pB} leading={leading === "b"} />
        </div>

        <div style={s.splitTrack}>
          <div style={{ width: `${pA}%`, background: CANDIDATE_A.color, height: "100%", transition: "width 0.9s cubic-bezier(.4,0,.2,1)" }} />
          <div style={{ width: `${pB}%`, background: CANDIDATE_B.color, height: "100%", transition: "width 0.9s cubic-bezier(.4,0,.2,1)" }} />
        </div>
        <div style={s.splitPcts}>
          <span style={{ color: CANDIDATE_A.color, fontWeight: 800 }}>{pA}%</span>
          <span style={{ color: CANDIDATE_B.color, fontWeight: 800 }}>{pB}%</span>
        </div>

        <div style={s.ctrlRow}>
          <button style={{ ...s.ctrlBtn, background: active ? "#7f1d1d" : "#14532d", flex: 2 }} onClick={toggleActive}>
            {active ? "⏹  Cerrar votación" : "▶  Abrir votación"}
          </button>
          <button style={{ ...s.ctrlBtn, background: "#1e293b", flex: 1 }} onClick={resetAll}>
            ↺ Reiniciar
          </button>
        </div>

        <div style={s.hint}>Los espectadores abren la misma URL · sin login</div>
      </div>
    </div>
  );
}

function Bar({ candidate, votes, pct, leading }) {
  return (
    <div style={s.barRow}>
      <div style={s.barMeta}>
        <div style={{ ...s.dot, background: candidate.color }} />
        <div>
          <div style={{ ...s.barName, color: leading ? candidate.color : "#e2e8f0" }}>
            {candidate.name}
            {leading && <span style={{ ...s.badge, borderColor: candidate.color, color: candidate.color }}>LIDERA</span>}
          </div>
          <div style={s.barVotes}>{votes.toLocaleString()} votos</div>
        </div>
      </div>
      <div style={s.track}>
        <div style={{ height: "100%", width: `${pct}%`, background: candidate.color, borderRadius: 4, transition: "width 0.9s cubic-bezier(.4,0,.2,1)" }} />
      </div>
      <div style={{ ...s.pctRight, color: candidate.color }}>{pct}%</div>
    </div>
  );
}

// ─── VIEWER PAGE ─────────────────────────────────────────────────────────────
function ViewerPage() {
  const [votes,     setVotesState] = useState({ a: 0, b: 0 });
  const [active,    setActiveState] = useState(false);
  const [myVote,    setMyVote]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [casting,   setCasting]   = useState(false);
  const [justVoted, setJustVoted] = useState(false);
  const resetTokenRef = useRef(null);

  useEffect(() => {
    // Restore local vote, check if reset happened
    const init = async () => {
      const token = await getResetToken();
      resetTokenRef.current = String(token);
      const myV = localGetVote();
      const myT = localGetReset();
      if (myV && myT === String(token)) {
        setMyVote(myV);
      } else if (myV) {
        localClearVote();
      }
      setLoading(false);
    };
    init();

    // Real-time listeners
    const unsubVotes = onValue(ref(db, "votes"), snap => {
      setVotesState(snap.exists() ? snap.val() : { a: 0, b: 0 });
    });
    const unsubActive = onValue(ref(db, "active"), snap => {
      setActiveState(snap.exists() ? snap.val() : false);
    });
    const unsubReset = onValue(ref(db, "resetToken"), snap => {
      const token = String(snap.val());
      if (resetTokenRef.current && token !== resetTokenRef.current) {
        resetTokenRef.current = token;
        localClearVote();
        setMyVote(null);
      } else {
        resetTokenRef.current = token;
      }
    });

    return () => { unsubVotes(); unsubActive(); unsubReset(); };
  }, []);

  const castVote = async (id) => {
    if (myVote || !active || casting) return;
    setCasting(true);
    try {
      const current = await getVotes();
      current[id] = (current[id] || 0) + 1;
      await setVotes(current);
      localSaveVote(id, resetTokenRef.current);
      setMyVote(id);
      setJustVoted(true);
      setTimeout(() => setJustVoted(false), 2000);
    } finally {
      setCasting(false);
    }
  };

  const total = votes.a + votes.b;
  const pA = pct(votes.a, total);
  const pB = pct(votes.b, total);

  if (loading) return (
    <div style={s.page}><div style={{ color: "#475569", fontSize: 16 }}>Conectando...</div></div>
  );

  return (
    <div style={s.page}>
      <div style={{ ...s.card, maxWidth: 400 }}>
        <div style={s.logo}>F*cks News</div>
        <div style={s.viewerSub}>Votación en vivo</div>

        <div style={{ ...s.statusPill, background: active ? "#14532d" : "#1c1917", borderColor: active ? "#22c55e" : "#44403c", marginBottom: 24 }}>
          <div style={{ ...s.statusDot, background: active ? "#22c55e" : "#78716c", boxShadow: active ? "0 0 8px #22c55e" : "none" }} />
          <span style={{ color: active ? "#86efac" : "#a8a29e", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em" }}>
            {active ? "VOTACIÓN ABIERTA" : "VOTACIÓN CERRADA"}
          </span>
        </div>

        {!myVote && (
          <>
            <div style={s.question}>¿Quién es tu presentador favorito?</div>
            <div style={s.vBtns}>
              {[CANDIDATE_A, CANDIDATE_B].map(c => (
                <button key={c.id}
                  style={{ ...s.vBtn, borderColor: c.color, opacity: (!active || casting) ? 0.4 : 1, cursor: (!active || casting) ? "not-allowed" : "pointer" }}
                  onClick={() => castVote(c.id)} disabled={!active || casting}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                  <span style={s.vBtnName}>{c.name}</span>
                </button>
              ))}
            </div>
            {!active && <div style={s.waitMsg}>Espera a que el presentador abra la votación</div>}
          </>
        )}

        {myVote && (
          <div style={{ ...s.votedBox, borderColor: justVoted ? "#22c55e" : "#1e293b" }}>
            <div style={s.votedCheck}>✓</div>
            <div style={s.votedTitle}>
              Votaste por{" "}
              <span style={{ color: myVote === "a" ? CANDIDATE_A.color : CANDIDATE_B.color }}>
                {myVote === "a" ? CANDIDATE_A.name : CANDIDATE_B.name}
              </span>
            </div>
            <div style={s.votedSub}>Tu voto fue registrado</div>
          </div>
        )}

        {(myVote || !active) && (
          <div style={s.results}>
            <div style={s.resultsTitle}>Resultados en vivo</div>
            <div style={s.rTotal}>{total.toLocaleString()} votos</div>
            {[CANDIDATE_A, CANDIDATE_B].map(c => {
              const p = c.id === "a" ? pA : pB;
              const v = c.id === "a" ? votes.a : votes.b;
              return (
                <div key={c.id} style={s.rRow}>
                  <div style={{ color: c.color, fontWeight: 700, fontSize: 12, width: 110, minWidth: 110 }}>{c.name}</div>
                  <div style={s.rTrack}>
                    <div style={{ width: `${p}%`, background: c.color, height: "100%", borderRadius: 3, transition: "width 0.9s cubic-bezier(.4,0,.2,1)" }} />
                  </div>
                  <div style={{ color: c.color, fontWeight: 800, fontSize: 13, width: 36, textAlign: "right" }}>{p}%</div>
                  <div style={{ color: "#334155", fontSize: 11, width: 36, textAlign: "right" }}>{v.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={s.presenterAccess}>
        <span style={s.presenterLink} onClick={() => window.__showPresenterLogin && window.__showPresenterLogin()}>
          Acceso presentador
        </span>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [showLogin,     setShowLogin]     = useState(false);
  const [loggedIn,      setLoggedIn]      = useState(false);
  const [presenterMode, setPresenterMode] = useState(false);

  useEffect(() => {
    window.__showPresenterLogin = () => setShowLogin(true);
    return () => { delete window.__showPresenterLogin; };
  }, []);

  if (showLogin && !loggedIn) {
    return <LoginScreen onLogin={() => { setLoggedIn(true); setPresenterMode(true); setShowLogin(false); }} />;
  }
  if (presenterMode && loggedIn) {
    return <PresenterDashboard onLogout={() => { setPresenterMode(false); setLoggedIn(false); }} />;
  }
  return <ViewerPage />;
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const s = {
  page: { minHeight: "100vh", background: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Georgia', 'Times New Roman', serif", padding: 16 },
  card: { background: "#1e293b", borderRadius: 16, padding: "40px 32px", width: "100%", boxShadow: "0 32px 64px rgba(0,0,0,0.6)" },
  logo: { fontSize: 28, fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.5px", textAlign: "center" },
  loginTitle: { color: "#94a3b8", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.12em", textAlign: "center", margin: "8px 0 28px" },
  field: { marginBottom: 16 },
  label: { display: "block", color: "#64748b", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 },
  input: { width: "100%", boxSizing: "border-box", background: "#0f172a", border: "1.5px solid #334155", borderRadius: 8, color: "#f1f5f9", fontSize: 15, padding: "10px 14px", outline: "none" },
  errMsg: { color: "#f87171", fontSize: 13, marginBottom: 12, textAlign: "center" },
  loginBtn: { width: "100%", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4 },
  shake: { animation: "shake 0.4s" },
  dashHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  dashSub: { color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" },
  logoutBtn: { background: "transparent", border: "1px solid #334155", color: "#64748b", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12 },
  statusPill: { display: "flex", alignItems: "center", gap: 8, border: "1px solid", borderRadius: 8, padding: "8px 14px", margin: "16px 0", justifyContent: "center" },
  statusDot: { width: 9, height: 9, borderRadius: "50%", transition: "all 0.4s" },
  totalWrap: { textAlign: "center", margin: "8px 0 28px" },
  totalNum: { display: "block", fontSize: 64, fontWeight: 800, letterSpacing: "-2px", color: "#f8fafc", lineHeight: 1 },
  totalLabel: { color: "#475569", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" },
  barsWrap: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 },
  barRow: { display: "flex", alignItems: "center", gap: 10 },
  barMeta: { display: "flex", alignItems: "center", gap: 8, width: 170, minWidth: 170 },
  dot: { width: 11, height: 11, borderRadius: "50%", flexShrink: 0 },
  barName: { fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 },
  barVotes: { color: "#475569", fontSize: 11, marginTop: 1 },
  badge: { fontSize: 9, border: "1px solid", borderRadius: 3, padding: "1px 5px", letterSpacing: "0.06em" },
  track: { flex: 1, height: 26, background: "#0f172a", borderRadius: 4, overflow: "hidden" },
  pctRight: { width: 40, textAlign: "right", fontSize: 15, fontWeight: 800 },
  vsLine: { textAlign: "center" },
  vs: { color: "#1e3a5f", fontSize: 11, letterSpacing: "0.2em" },
  splitTrack: { display: "flex", height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 4 },
  splitPcts: { display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 24 },
  ctrlRow: { display: "flex", gap: 10 },
  ctrlBtn: { color: "#f1f5f9", border: "none", borderRadius: 8, padding: "13px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  hint: { textAlign: "center", color: "#334155", fontSize: 11, marginTop: 16 },
  viewerSub: { color: "#475569", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", textAlign: "center", margin: "6px 0 20px" },
  question: { color: "#94a3b8", fontSize: 15, textAlign: "center", marginBottom: 18 },
  vBtns: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 },
  vBtn: { display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderRadius: 10, border: "2px solid", background: "#0f172a", cursor: "pointer", transition: "all 0.2s" },
  vBtnName: { color: "#f1f5f9", fontSize: 17, fontWeight: 700 },
  waitMsg: { color: "#475569", fontSize: 12, textAlign: "center", marginTop: 4 },
  votedBox: { border: "1.5px solid", borderRadius: 10, padding: "20px 16px", textAlign: "center", marginBottom: 20, transition: "border-color 0.5s" },
  votedCheck: { fontSize: 28, color: "#22c55e", marginBottom: 6 },
  votedTitle: { color: "#e2e8f0", fontSize: 16, fontWeight: 700, marginBottom: 4 },
  votedSub: { color: "#475569", fontSize: 12 },
  results: { borderTop: "1px solid #1e293b", paddingTop: 20 },
  resultsTitle: { color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", textAlign: "center", marginBottom: 4 },
  rTotal: { color: "#334155", fontSize: 12, textAlign: "center", marginBottom: 16 },
  rRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  rTrack: { flex: 1, height: 18, background: "#0f172a", borderRadius: 3, overflow: "hidden" },
  presenterAccess: { marginTop: 20 },
  presenterLink: { color: "#1e3a5f", fontSize: 11, cursor: "pointer", userSelect: "none" },
};