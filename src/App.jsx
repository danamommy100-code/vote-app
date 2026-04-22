import { useState, useEffect } from "react";
import { db } from "./firebase";
import { ref, set, get, onValue, remove } from "firebase/database";

function dbSet(path, val) { return set(ref(db, path), val); }
function dbGet(path) { return get(ref(db, path)).then(s => s.val()); }
function dbDel(path) { return remove(ref(db, path)); }

let CACHE = {};
function useDB() {
  const [data, setData] = useState({});
  useEffect(() => {
    const r = ref(db, "/");
    const unsub = onValue(r, snap => {
      CACHE = snap.val() || {};
      setData({ ...CACHE });
    });
    return () => unsub();
  }, []);
  return data;
}
function cacheGet(path) {
  const keys = path.split("/");
  let cur = CACHE;
  for (const k of keys) { if (cur == null) return undefined; cur = cur[k]; }
  return cur;
}

const genCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();
const genId = () => Math.random().toString(36).slice(2, 10);
const AGE_OPTIONS = ["20대", "30대", "40대", "50대 이상"];
const SCORE_OPTIONS = ["Bad", "Good", "Very Good", "Excellent"];
const SCORE_COLORS = ["#EF4444", "#F59E0B", "#3B82F6", "#10B981"];

export default function App() {
  const [screen, setScreen] = useState("home");
  const [roomCode, setRoomCode] = useState("");
  const [pInfo, setPInfo] = useState(null);
  useDB();

  if (screen === "home") return <Home onAdmin={() => setScreen("admin")} onJoin={() => setScreen("join")} />;
  if (screen === "admin") return <AdminApp onBack={() => setScreen("home")} />;
  if (screen === "join") return <JoinScreen initCode={roomCode} onBack={() => setScreen("home")}
    onJoined={(info, code) => { setPInfo(info); setRoomCode(code); setScreen("participant"); }} />;
  if (screen === "participant") return <ParticipantApp info={pInfo} roomCode={roomCode} onExit={() => setScreen("home")} />;
}

// ─── 홈 ───────────────────────────────────────────────────────────────────
function Home({ onAdmin, onJoin }) {
  const [showPw, setShowPw] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  function checkPw() {
    if (pw === "0070") { setShowPw(false); setPw(""); setErr(""); onAdmin(); }
    else { setErr("비밀번호가 틀렸습니다."); }
  }

  return (
    <div style={s.page}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🏷️</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111", marginBottom: 6 }}>알레르망 품평회</h1>
        <p style={{ color: "#999", fontSize: 14 }}>실시간 현장 투표</p>
      </div>
      <button style={s.btnPrimary} onClick={() => setShowPw(true)}>⚙️ 관리자 입장</button>
      <button style={{ ...s.btnOutline, marginTop: 12 }} onClick={onJoin}>📱 참여자 입장</button>

      {showPw && (
        <div style={s.modal}>
          <div style={s.modalBox}>
            <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, textAlign: "center" }}>관리자 비밀번호</p>
            <input style={{ ...s.input, textAlign: "center", fontSize: 22, letterSpacing: 8 }}
              type="password" value={pw} onChange={e => setPw(e.target.value)}
              placeholder="••••" maxLength={4}
              onKeyDown={e => e.key === "Enter" && checkPw()} autoFocus />
            {err && <p style={{ ...s.err, textAlign: "center" }}>{err}</p>}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button style={{ ...s.btnOutline, flex: 1 }} onClick={() => { setShowPw(false); setPw(""); setErr(""); }}>취소</button>
              <button style={{ ...s.btnPrimary, flex: 1 }} onClick={checkPw}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 참여자 입장 ──────────────────────────────────────────────────────────
function JoinScreen({ initCode, onBack, onJoined }) {
  const [code, setCode] = useState(initCode || "");
  const [dept, setDept] = useState("");
  const [age, setAge] = useState("");
  const [err, setErr] = useState("");
  const [step, setStep] = useState(1);

  async function checkRoom() {
    const room = await dbGet(`rooms/${code.toUpperCase()}`);
    if (!room) { setErr("존재하지 않는 방 코드입니다."); return; }
    setErr(""); setStep(2);
  }
  async function join() {
    if (!dept.trim()) { setErr("소속을 입력해주세요."); return; }
    if (!age) { setErr("연령대를 선택해주세요."); return; }
    const info = { id: genId(), dept: dept.trim(), age, joinedAt: Date.now() };
    await dbSet(`rooms/${code.toUpperCase()}/participants/${info.id}`, info);
    onJoined(info, code.toUpperCase());
  }
  return (
    <div style={s.page}>
      <button style={s.back} onClick={onBack}>← 뒤로</button>
      <h2 style={s.title}>참여자 입장</h2>
      {step === 1 && <>
        <label style={s.label}>방 코드 입력</label>
        <input style={s.input} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="예: AB12C" maxLength={6} />
        {err && <p style={s.err}>{err}</p>}
        <button style={{ ...s.btnPrimary, marginTop: 20 }} onClick={checkRoom}>확인</button>
      </>}
      {step === 2 && <>
        <label style={s.label}>소속 부서 / 업체명</label>
        <input style={s.input} value={dept} onChange={e => setDept(e.target.value)} placeholder="예: 디자인팀, ○○업체" />
        <label style={s.label}>연령대</label>
        <select style={s.select} value={age} onChange={e => setAge(e.target.value)}>
          <option value="">선택하세요</option>
          {AGE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {err && <p style={s.err}>{err}</p>}
        <button style={{ ...s.btnPrimary, marginTop: 20 }} onClick={join}>입장하기</button>
      </>}
    </div>
  );
}

// ─── 관리자 앱 ─────────────────────────────────────────────────────────────
function AdminApp({ onBack }) {
  useDB();
  const [view, setView] = useState("list");
  const [activeCode, setActiveCode] = useState(null);
  const [createTitle, setCreateTitle] = useState("");
  const [err, setErr] = useState("");
  const [delTarget, setDelTarget] = useState(null);
  const [delPw, setDelPw] = useState("");
  const [delErr, setDelErr] = useState("");

  async function createRoom() {
    if (!createTitle.trim()) { setErr("방 제목을 입력해주세요."); return; }
    const code = genCode();
    await dbSet(`rooms/${code}`, {
      code, title: createTitle.trim(),
      participants: {}, votes: {}, voteList: [],
      currentVoteIdx: null, votingOpen: false,
      createdAt: Date.now(),
    });
    setCreateTitle(""); setErr("");
    setActiveCode(code); setView("room");
  }

  async function deleteRoom(code) {
    if (delPw !== "7777") { setDelErr("비밀번호가 틀렸습니다."); return; }
    await dbDel(`rooms/${code}`);
    setDelTarget(null); setDelPw(""); setDelErr("");
  }

  const rooms = Object.values(cacheGet("rooms") || {});

  if (view === "room" && activeCode) return <AdminRoom code={activeCode} onBack={() => { setActiveCode(null); setView("list"); }} />;

  return (
    <div style={{ minHeight: "100vh", background: "#F8F8F8" }}>
      <div style={s.adminHeader}>
        <button style={s.back} onClick={onBack}>← 홈</button>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>관리자</h2>
        <div />
      </div>
      <div style={{ padding: 20 }}>
        {view === "list" && <>
          <button style={s.btnPrimary} onClick={() => setView("create")}>+ 새 품평회 방 만들기</button>
          <div style={{ marginTop: 20 }}>
            {rooms.length === 0 && <p style={{ color: "#bbb", textAlign: "center", marginTop: 40, fontSize: 14 }}>생성된 방이 없습니다.</p>}
            {rooms.map(r => (
              <div key={r.code} style={s.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{r.title}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 13, color: "#6366F1", fontWeight: 600 }}>코드: {r.code}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={s.btnSm} onClick={() => { setActiveCode(r.code); setView("room"); }}>입장 →</button>
                    <button style={{ ...s.btnSm, background: "#FEE2E2", color: "#EF4444" }}
                      onClick={() => { setDelTarget(r.code); setDelPw(""); setDelErr(""); }}>삭제</button>
                  </div>
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "#999" }}>
                  참여자 {Object.keys(r.participants || {}).length}명 · 투표 {(r.voteList || []).length}개
                </p>
              </div>
            ))}
          </div>
        </>}
        {view === "create" && <>
          <button style={s.back} onClick={() => setView("list")}>← 목록으로</button>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>새 품평회 방 만들기</h3>
          <label style={s.label}>품평회 제목 *</label>
          <input style={s.input} value={createTitle} onChange={e => setCreateTitle(e.target.value)} placeholder="예: 2025 SS 컬렉션 품평회" />
          {err && <p style={s.err}>{err}</p>}
          <button style={{ ...s.btnPrimary, marginTop: 24 }} onClick={createRoom}>방 만들기 →</button>
        </>}
      </div>

      {/* 삭제 비밀번호 모달 */}
      {delTarget && (
        <div style={s.modal}>
          <div style={s.modalBox}>
            <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, textAlign: "center" }}>방 삭제</p>
            <p style={{ fontSize: 13, color: "#888", textAlign: "center", marginBottom: 16 }}>삭제 비밀번호를 입력하세요</p>
            <input style={{ ...s.input, textAlign: "center", fontSize: 22, letterSpacing: 8 }}
              type="password" value={delPw} onChange={e => setDelPw(e.target.value)}
              placeholder="••••" maxLength={4} autoFocus
              onKeyDown={e => e.key === "Enter" && deleteRoom(delTarget)} />
            {delErr && <p style={{ ...s.err, textAlign: "center" }}>{delErr}</p>}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button style={{ ...s.btnOutline, flex: 1 }} onClick={() => { setDelTarget(null); setDelPw(""); setDelErr(""); }}>취소</button>
              <button style={{ ...s.btnPrimary, flex: 1, background: "#EF4444" }} onClick={() => deleteRoom(delTarget)}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 관리자 방 내부 ─────────────────────────────────────────────────────────
function AdminRoom({ code, onBack }) {
  useDB();
  const [tab, setTab] = useState("main");
  const [showBuilder, setShowBuilder] = useState(false);
  const [resultVoteIdx, setResultVoteIdx] = useState(null);

  const room = cacheGet(`rooms/${code}`);
  if (!room) return <div style={s.page}><p>로딩 중...</p></div>;

  const voteList = room.voteList || [];
  const participants = Object.values(room.participants || {});
  const currentIdx = room.currentVoteIdx;
  const currentResponses = currentIdx !== null ? Object.values((room.votes || {})[currentIdx] || {}) : [];

  async function addVote(voteConfig) {
    const newVote = { ...voteConfig, id: genId(), status: "pending" };
    await dbSet(`rooms/${code}/voteList`, [...voteList, newVote]);
    setShowBuilder(false);
  }

  async function openVote(idx) {
    const updated = voteList.map((v, i) => i === idx ? { ...v, status: "open" } : v.status === "open" ? { ...v, status: "pending" } : v);
    await dbSet(`rooms/${code}/voteList`, updated);
    await dbSet(`rooms/${code}/currentVoteIdx`, idx);
    await dbSet(`rooms/${code}/votingOpen`, true);
  }

  async function closeVote() {
    if (currentIdx === null) return;
    const updated = voteList.map((v, i) => i === currentIdx ? { ...v, status: "closed" } : v);
    await dbSet(`rooms/${code}/voteList`, updated);
    await dbSet(`rooms/${code}/votingOpen`, false);
    await dbSet(`rooms/${code}/currentVoteIdx`, null);
    setResultVoteIdx(currentIdx);
    setTab("result");
  }

  function downloadCSV() {
    const rows = [["Vote번호", "Vote명", "유형", "참여자ID", "소속", "연령대", "답변", "시각"]];
    Object.entries(room.votes || {}).forEach(([vidx, vmap]) => {
      const vInfo = voteList[Number(vidx)];
      Object.values(vmap || {}).forEach(resp => {
        const p = (room.participants || {})[resp.participantId] || {};
        const ans = Array.isArray(resp.answer) ? resp.answer.join("|") : resp.answer;
        rows.push([`Vote ${Number(vidx) + 1}`, vInfo?.label || "", vInfo?.type || "", resp.participantId, p.dept || "", p.age || "", ans, new Date(resp.ts).toLocaleString()]);
      });
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `품평회_${code}_결과.csv`; a.click();
  }

  const tabs = [{ id: "main", label: "🎛️ 진행" }, { id: "result", label: "📊 결과" }, { id: "allresults", label: "📈 전체" }];

  return (
    <div style={{ minHeight: "100vh", background: "#F8F8F8" }}>
      <div style={s.adminHeader}>
        <button style={s.back} onClick={onBack}>← 뒤로</button>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{room.title}</p>
          <p style={{ margin: 0, fontSize: 12, color: "#6366F1", fontWeight: 600 }}>코드: {code}</p>
        </div>
        <button style={{ ...s.btnSm, background: "#10B981", color: "#fff", fontSize: 12 }} onClick={downloadCSV}>↓ CSV</button>
      </div>
      <div style={s.tabs}>{tabs.map(t => <button key={t.id} style={tab === t.id ? s.tabActive : s.tabInactive} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
      <div style={{ padding: 16 }}>
        {tab === "main" && <>
          <div style={{ ...s.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, color: "#999" }}>현재 참여자</p>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>{participants.length}<span style={{ fontSize: 14, color: "#999", fontWeight: 400 }}>명</span></p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 13, color: "#999" }}>진행중 투표</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: room.votingOpen ? "#10B981" : "#bbb" }}>
                {room.votingOpen ? `Vote ${currentIdx + 1} 🟢` : "대기중"}
              </p>
            </div>
          </div>

          {room.votingOpen && voteList[currentIdx] && (
            <div style={{ ...s.card, border: "2px solid #10B981" }}>
              <p style={{ margin: "0 0 6px" }}><span style={s.badge("green")}>🟢 진행중 · Vote {currentIdx + 1}</span></p>
              <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 15 }}>{voteList[currentIdx].label}</p>
              <div style={{ background: "#F0FDF4", borderRadius: 10, padding: "10px 14px", margin: "10px 0 12px" }}>
                <p style={{ margin: 0, fontSize: 13, color: "#166534" }}>응답 완료: <strong>{currentResponses.length}</strong> / {participants.length}명</p>
                <div style={{ background: "#BBF7D0", borderRadius: 6, height: 6, marginTop: 6 }}>
                  <div style={{ background: "#16A34A", height: 6, borderRadius: 6, width: participants.length ? `${(currentResponses.length / participants.length) * 100}%` : "0%", transition: "width 0.4s" }} />
                </div>
              </div>
              <button style={{ ...s.btnPrimary, background: "#EF4444" }} onClick={closeVote}>■ 투표 종료 &amp; 결과 보기</button>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "4px 0 12px" }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>투표 목록</p>
            <button style={s.btnSm} onClick={() => setShowBuilder(true)}>+ 투표 추가</button>
          </div>

          {voteList.length === 0 && !showBuilder && (
            <div style={{ ...s.card, textAlign: "center", color: "#bbb", padding: "28px 16px" }}>
              <p style={{ margin: 0, fontSize: 14 }}>아직 투표가 없습니다.</p>
            </div>
          )}

          {voteList.map((v, idx) => {
            const responses = Object.values((room.votes || {})[idx] || {});
            const isOpen = v.status === "open";
            const isClosed = v.status === "closed";
            return (
              <div key={v.id} style={{ ...s.card, border: isOpen ? "2px solid #10B981" : "2px solid #F3F4F6" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <span style={s.badge(isOpen ? "green" : isClosed ? "gray" : "blue")}>
                        Vote {idx + 1} {isOpen ? "🟢" : isClosed ? "✅" : "⏸"}
                      </span>
                      <span style={{ fontSize: 11, color: "#888", background: "#F3F4F6", borderRadius: 6, padding: "2px 7px" }}>
                        {v.type === "score" ? "점수 평가" : "디자인 평가"}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{v.label}</p>
                    {v.type === "design" && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#888" }}>{v.totalItems}개 중 {v.maxSelect}개 선택</p>}
                    {isClosed && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6366F1" }}>응답 {responses.length}명</p>}
                  </div>
                  {!isOpen && !isClosed && <button style={{ ...s.btnSm, background: "#6366F1", color: "#fff" }} onClick={() => openVote(idx)}>▶ 시작</button>}
                  {isClosed && <button style={s.btnSmOutline} onClick={() => { setResultVoteIdx(idx); setTab("result"); }}>결과 보기</button>}
                </div>
              </div>
            );
          })}
          {showBuilder && <VoteBuilder onSave={addVote} onCancel={() => setShowBuilder(false)} />}
        </>}
        {tab === "result" && <VoteResult room={room} voteList={voteList} participants={participants} initIdx={resultVoteIdx !== null ? resultVoteIdx : voteList.findLastIndex(v => v.status === "closed")} />}
        {tab === "allresults" && <AllResults room={room} voteList={voteList} participants={participants} />}
      </div>
    </div>
  );
}

// ─── 투표 빌더 ─────────────────────────────────────────────────────────────
function VoteBuilder({ onSave, onCancel }) {
  const [type, setType] = useState("");
  const [label, setLabel] = useState("");
  const [totalItems, setTotalItems] = useState(5);
  const [maxSelect, setMaxSelect] = useState(1);
  const [err, setErr] = useState("");

  function save() {
    if (!type) { setErr("유형을 선택해주세요."); return; }
    if (!label.trim()) { setErr("질문 라벨을 입력해주세요."); return; }
    if (type === "design" && Number(maxSelect) > Number(totalItems)) { setErr("선택 개수는 총 개수보다 클 수 없습니다."); return; }
    onSave({ type, label: label.trim(), totalItems: type === "design" ? Number(totalItems) : null, maxSelect: type === "design" ? Number(maxSelect) : null });
  }

  return (
    <div style={{ ...s.card, border: "2px solid #6366F1" }}>
      <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>새 투표 만들기</p>
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        {[{ id: "score", icon: "⭐", name: "점수 평가", desc: "Bad → Excellent" }, { id: "design", icon: "🎨", name: "디자인 평가", desc: "N개 중 M개 선택" }].map(t => (
          <button key={t.id} onClick={() => { setType(t.id); setErr(""); }}
            style={{ flex: 1, padding: "14px 10px", borderRadius: 12, cursor: "pointer", textAlign: "center", border: type === t.id ? "2px solid #6366F1" : "2px solid #E5E7EB", background: type === t.id ? "#EEF2FF" : "#fff" }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{t.icon}</div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: type === t.id ? "#6366F1" : "#111" }}>{t.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#999" }}>{t.desc}</p>
          </button>
        ))}
      </div>
      {type && <>
        <label style={s.label}>질문 라벨</label>
        <input style={s.input} value={label} onChange={e => setLabel(e.target.value)} placeholder={type === "score" ? "예: 전체 디자인 만족도" : "예: 선호 디자인을 선택하세요"} />
        {type === "design" && (
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><label style={s.label}>디자인 총 개수</label><input style={s.input} type="number" min={2} max={30} value={totalItems} onChange={e => setTotalItems(e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={s.label}>선택 개수</label><input style={s.input} type="number" min={1} max={totalItems} value={maxSelect} onChange={e => setMaxSelect(e.target.value)} /></div>
          </div>
        )}
      </>}
      {err && <p style={s.err}>{err}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button style={{ ...s.btnOutline, flex: 1 }} onClick={onCancel}>취소</button>
        <button style={{ ...s.btnPrimary, flex: 1 }} onClick={save}>저장</button>
      </div>
    </div>
  );
}

// ─── 개별 투표 결과 ─────────────────────────────────────────────────────────
function VoteResult({ room, voteList, participants, initIdx }) {
  const closedVotes = voteList.map((v, i) => ({ ...v, idx: i })).filter(v => v.status === "closed");
  const [selIdx, setSelIdx] = useState(initIdx >= 0 ? initIdx : closedVotes[closedVotes.length - 1]?.idx ?? null);
  const [filter, setFilter] = useState({ type: "all", value: "" });

  if (closedVotes.length === 0) return <div style={{ ...s.card, textAlign: "center", color: "#bbb", padding: "32px 16px" }}><p style={{ margin: 0 }}>종료된 투표가 없습니다.</p></div>;

  const vote = selIdx !== null ? voteList[selIdx] : null;
  const allResponses = selIdx !== null ? Object.values((room.votes || {})[selIdx] || {}) : [];
  const depts = [...new Set(participants.map(p => p.dept))];

  function filtered() {
    if (filter.type === "all") return allResponses;
    return allResponses.filter(r => {
      const p = (room.participants || {})[r.participantId];
      return filter.type === "dept" ? p?.dept === filter.value : p?.age === filter.value;
    });
  }
  const responses = filtered();

  return (
    <>
      <div style={s.card}>
        <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>결과 보기</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {closedVotes.map(v => <button key={v.idx} style={selIdx === v.idx ? s.btnSm : s.btnSmOutline} onClick={() => setSelIdx(v.idx)}>Vote {v.idx + 1}</button>)}
        </div>
      </div>
      {vote && <>
        <div style={s.card}>
          <p style={{ margin: "0 0 2px", fontSize: 13, color: "#888" }}>Vote {selIdx + 1}</p>
          <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 16 }}>{vote.label}</p>
          <p style={{ margin: 0, fontSize: 13, color: "#888" }}>전체 응답: <strong style={{ color: "#111" }}>{allResponses.length}명</strong> / {participants.length}명</p>
        </div>
        <div style={s.card}>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>🔍 필터</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button style={filter.type === "all" ? s.btnSm : s.btnSmOutline} onClick={() => setFilter({ type: "all", value: "" })}>전체 ({allResponses.length}명)</button>
            {depts.map(d => { const cnt = allResponses.filter(r => (room.participants || {})[r.participantId]?.dept === d).length; return <button key={d} style={filter.type === "dept" && filter.value === d ? s.btnSm : s.btnSmOutline} onClick={() => setFilter({ type: "dept", value: d })}>{d} ({cnt}명)</button>; })}
            {AGE_OPTIONS.map(a => { const cnt = allResponses.filter(r => (room.participants || {})[r.participantId]?.age === a).length; if (!cnt) return null; return <button key={a} style={filter.type === "age" && filter.value === a ? s.btnSm : s.btnSmOutline} onClick={() => setFilter({ type: "age", value: a })}>{a} ({cnt}명)</button>; })}
          </div>
          {filter.type !== "all" && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6366F1" }}>필터 결과: {responses.length}명</p>}
        </div>
        {vote.type === "score" && <ScoreChart responses={responses} />}
        {vote.type === "design" && <DesignChart responses={responses} vote={vote} />}
      </>}
    </>
  );
}

function ScoreChart({ responses }) {
  const counts = {}; SCORE_OPTIONS.forEach(k => counts[k] = 0);
  responses.forEach(r => { if (r.answer) counts[r.answer] = (counts[r.answer] || 0) + 1; });
  const max = Math.max(...Object.values(counts), 1); const total = responses.length;
  return (
    <div style={s.card}>
      <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>⭐ 점수 분포</p>
      {SCORE_OPTIONS.map((k, i) => { const pct = total ? Math.round((counts[k] / total) * 100) : 0; return (
        <div key={k} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
            <span style={{ fontWeight: 600 }}>{k}</span><span style={{ color: "#888" }}>{counts[k]}명 <span style={{ color: SCORE_COLORS[i], fontWeight: 700 }}>({pct}%)</span></span>
          </div>
          <div style={{ background: "#F3F4F6", borderRadius: 6, height: 26 }}>
            <div style={{ background: SCORE_COLORS[i], height: 26, borderRadius: 6, width: `${(counts[k] / max) * 100}%`, transition: "width 0.4s" }} />
          </div>
        </div>
      ); })}
    </div>
  );
}

function DesignChart({ responses, vote }) {
  const counts = {}; Array.from({ length: vote.totalItems }, (_, i) => i + 1).forEach(n => counts[n] = 0);
  responses.forEach(r => (Array.isArray(r.answer) ? r.answer : []).forEach(n => { counts[n] = (counts[n] || 0) + 1; }));
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]); const max = Math.max(...Object.values(counts), 1); const total = responses.length;
  return (
    <div style={s.card}>
      <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🎨 디자인 선호도</p>
      <p style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>{vote.totalItems}개 중 {vote.maxSelect}개 선택 · {total}명 응답</p>
      {sorted.map(([n, cnt], rank) => { const pct = total ? Math.round((cnt / total) * 100) : 0; const medal = rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : ""; return (
        <div key={n} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
            <span style={{ fontWeight: 600 }}>{medal} 디자인 #{n}</span><span style={{ color: "#888" }}>{cnt}표 <span style={{ color: "#6366F1", fontWeight: 700 }}>({pct}%)</span></span>
          </div>
          <div style={{ background: "#F3F4F6", borderRadius: 6, height: 22 }}>
            <div style={{ background: rank === 0 ? "#6366F1" : rank === 1 ? "#8B5CF6" : "#A78BFA", height: 22, borderRadius: 6, width: `${(cnt / max) * 100}%`, transition: "width 0.4s" }} />
          </div>
        </div>
      ); })}
    </div>
  );
}

function AllResults({ room, voteList, participants }) {
  const closedVotes = voteList.map((v, i) => ({ ...v, idx: i })).filter(v => v.status === "closed");
  if (closedVotes.length === 0) return <div style={{ ...s.card, textAlign: "center", color: "#bbb", padding: "32px 16px" }}><p style={{ margin: 0 }}>종료된 투표가 없습니다.</p></div>;
  return (
    <>
      <div style={s.card}>
        <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 15 }}>{room.title}</p>
        <p style={{ margin: 0, fontSize: 13, color: "#888" }}>총 {closedVotes.length}개 투표 완료 · 참여자 {participants.length}명</p>
      </div>
      {closedVotes.map(v => {
        const responses = Object.values((room.votes || {})[v.idx] || {});
        const counts = {};
        if (v.type === "score") { SCORE_OPTIONS.forEach(k => counts[k] = 0); responses.forEach(r => { if (r.answer) counts[r.answer] = (counts[r.answer] || 0) + 1; }); }
        else { Array.from({ length: v.totalItems }, (_, i) => i + 1).forEach(n => counts[n] = 0); responses.forEach(r => (Array.isArray(r.answer) ? r.answer : []).forEach(n => { counts[n] = (counts[n] || 0) + 1; })); }
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return (
          <div key={v.id} style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={s.badge("gray")}>Vote {v.idx + 1} · {v.type === "score" ? "점수" : "디자인"}</span>
                <p style={{ margin: "6px 0 2px", fontWeight: 700, fontSize: 14 }}>{v.label}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#888" }}>{responses.length}명 응답</p>
              </div>
              {top && <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 11, color: "#888" }}>최다 선택</p>
                <p style={{ margin: "2px 0 0", fontWeight: 800, color: "#6366F1", fontSize: 15 }}>{v.type === "score" ? top[0] : `#${top[0]}`}</p>
                <p style={{ margin: 0, fontSize: 11, color: "#888" }}>{top[1]}표</p>
              </div>}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ─── 참여자 앱 ─────────────────────────────────────────────────────────────
function ParticipantApp({ info, roomCode, onExit }) {
  useDB();
  const [submitted, setSubmitted] = useState({});
  const [answer, setAnswer] = useState(null);

  const room = cacheGet(`rooms/${roomCode}`);
  if (!room) return <div style={s.page}><p>로딩 중...</p></div>;

  const idx = room.currentVoteIdx;
  const vote = idx !== null ? (room.voteList || [])[idx] : null;
  const isOpen = room.votingOpen && vote && vote.status === "open";
  const alreadyVoted = idx !== null && submitted[idx];

  function toggleDesign(n) {
    setAnswer(prev => {
      const cur = Array.isArray(prev) ? prev : [];
      if (cur.includes(n)) return cur.filter(x => x !== n);
      if (cur.length >= vote.maxSelect) return prev;
      return [...cur, n];
    });
  }

  async function submit() {
    if (!canSubmit) return;
    const resp = { participantId: info.id, answer, ts: Date.now() };
    await dbSet(`rooms/${roomCode}/votes/${idx}/${info.id}`, resp);
    setSubmitted(prev => ({ ...prev, [idx]: true }));
    setAnswer(null);
    try { localStorage.setItem(`vote_${roomCode}_${idx}`, JSON.stringify(resp)); } catch (_) {}
  }

  const canSubmit = vote?.type === "score" ? !!answer : Array.isArray(answer) && answer.length > 0;

  if (!isOpen || alreadyVoted) {
    return (
      <div style={{ ...s.page, alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ fontSize: 60, marginBottom: 16 }}>{alreadyVoted ? "✅" : "⏳"}</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px", textAlign: "center" }}>{alreadyVoted ? "제출 완료!" : "대기 중"}</h2>
        <p style={{ color: "#999", fontSize: 14, textAlign: "center", lineHeight: 1.8 }}>{alreadyVoted ? "다음 투표를 기다려주세요." : "진행자의 투표 시작을 기다려주세요."}</p>
        <div style={{ marginTop: 20, padding: "14px 20px", background: "#F3F4F6", borderRadius: 14, textAlign: "center" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#6366F1" }}>{room.title}</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#999" }}>{info.dept} · {info.age} · 방 코드 {roomCode}</p>
        </div>
        <button style={{ ...s.btnOutline, marginTop: 24 }} onClick={onExit}>나가기</button>
      </div>
    );
  }

  return (
    <div style={{ background: "#F8F8F8", minHeight: "100vh", paddingBottom: 40 }}>
      <div style={{ background: "#6366F1", padding: "16px 20px", color: "#fff" }}>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>{room.title} · Vote {idx + 1}</p>
        <p style={{ margin: "4px 0 0", fontWeight: 700, fontSize: 17 }}>{vote.label}</p>
      </div>
      <div style={{ padding: 16 }}>
        <div style={s.card}>
          {vote.type === "score" && (
            <>
              <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, color: "#555" }}>하나를 선택해주세요</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {SCORE_OPTIONS.map((opt, i) => (
                  <button key={opt} onClick={() => setAnswer(opt)}
                    style={{ padding: "18px 0", borderRadius: 14, border: answer === opt ? `2px solid ${SCORE_COLORS[i]}` : "2px solid #E5E7EB", background: answer === opt ? SCORE_COLORS[i] : "#fff", color: answer === opt ? "#fff" : "#333", fontWeight: 700, fontSize: 17, cursor: "pointer", transition: "all 0.15s" }}>
                    {opt}
                  </button>
                ))}
              </div>
            </>
          )}
          {vote.type === "design" && (
            <>
              <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: "#555" }}>{vote.maxSelect}개 선택해주세요</p>
              <p style={{ fontSize: 13, color: "#6366F1", marginBottom: 14 }}>{(Array.isArray(answer) ? answer : []).length} / {vote.maxSelect} 선택됨</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {Array.from({ length: vote.totalItems }, (_, i) => i + 1).map(n => {
                  const sel = Array.isArray(answer) && answer.includes(n);
                  const disabled = !sel && (Array.isArray(answer) ? answer : []).length >= vote.maxSelect;
                  return (
                    <button key={n} onClick={() => toggleDesign(n)} disabled={disabled}
                      style={{ width: 64, height: 64, borderRadius: 14, border: "none", cursor: disabled ? "not-allowed" : "pointer", fontWeight: 800, fontSize: 16, opacity: disabled ? 0.3 : 1, transition: "all 0.15s", background: sel ? "#6366F1" : "#F3F4F6", color: sel ? "#fff" : "#444", transform: sel ? "scale(1.1)" : "scale(1)", boxShadow: sel ? "0 4px 12px rgba(99,102,241,0.3)" : "none" }}>
                      #{n}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <button onClick={submit} disabled={!canSubmit} style={{ ...s.btnPrimary, fontSize: 18, padding: "18px 0", opacity: canSubmit ? 1 : 0.35 }}>제출하기</button>
      </div>
    </div>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────
const s = {
  page: { display: "flex", flexDirection: "column", minHeight: "100vh", padding: "40px 24px 32px", maxWidth: 480, margin: "0 auto" },
  title: { fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 24 },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6, marginTop: 14 },
  input: { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 15, background: "#fff", boxSizing: "border-box", outline: "none" },
  select: { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 15, background: "#fff", boxSizing: "border-box", outline: "none" },
  err: { color: "#EF4444", fontSize: 13, marginTop: 6 },
  btnPrimary: { width: "100%", padding: "16px 0", background: "#111", color: "#fff", borderRadius: 14, border: "none", fontSize: 16, fontWeight: 700, cursor: "pointer" },
  btnOutline: { width: "100%", padding: "14px 0", background: "#fff", color: "#111", borderRadius: 14, border: "1.5px solid #E5E7EB", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  btnSm: { padding: "7px 14px", background: "#111", color: "#fff", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnSmOutline: { padding: "7px 14px", background: "#fff", color: "#555", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, cursor: "pointer" },
  back: { background: "none", border: "none", fontSize: 14, color: "#999", cursor: "pointer", padding: 0, marginBottom: 20 },
  card: { background: "#fff", borderRadius: 16, padding: "18px 16px", marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  adminHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", background: "#fff", borderBottom: "1px solid #F0F0F0", position: "sticky", top: 0, zIndex: 10 },
  tabs: { display: "flex", borderBottom: "1px solid #F0F0F0", background: "#fff" },
  tabActive: { flex: 1, padding: "12px 0", background: "none", border: "none", borderBottom: "2px solid #6366F1", color: "#6366F1", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  tabInactive: { flex: 1, padding: "12px 0", background: "none", border: "none", borderBottom: "2px solid transparent", color: "#888", fontSize: 14, cursor: "pointer" },
  modal: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modalBox: { background: "#fff", borderRadius: 20, padding: "32px 24px", width: 300 },
  badge: (color) => ({ display: "inline-block", fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px", background: color === "green" ? "#D1FAE5" : color === "blue" ? "#EEF2FF" : "#F3F4F6", color: color === "green" ? "#065F46" : color === "blue" ? "#4338CA" : "#555" }),
};