"use client";

import { useEffect, useMemo, useState } from "react";

type Player = { id: string; name: string; score: number };
type AwardLog = { id: string; playerName: string; amount: number; totalAfter: number; createdAt: number };
type GameState = { players: Player[]; activePlayerId: string; currentScore: number; logs: AwardLog[] };

const STORAGE_KEY = "greed-dice-scoreboard-v1";
const initialState: GameState = {
  players: [
    { id: "player-1", name: "플레이어 1", score: 0 },
    { id: "player-2", name: "플레이어 2", score: 0 },
  ],
  activePlayerId: "player-1",
  currentScore: 0,
  logs: [],
};

const formatScore = (score: number) => score.toLocaleString("ko-KR");
const formatTime = (timestamp: number) => new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(timestamp);
const makeId = () => `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function loadGame(): GameState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return initialState;
    const parsed = JSON.parse(stored) as Partial<GameState>;
    return {
      ...initialState,
      ...parsed,
      players: parsed.players?.length ? parsed.players : initialState.players,
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    };
  } catch {
    return initialState;
  }
}

export default function Home() {
  const [game, setGame] = useState<GameState>(loadGame);
  const [setupOpen, setSetupOpen] = useState(() => !localStorage.getItem(STORAGE_KEY));
  const [restartOpen, setRestartOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [editingScore, setEditingScore] = useState(false);
  const [scoreInput, setScoreInput] = useState("0");
  const [undoState, setUndoState] = useState<GameState | null>(null);
  const [notice, setNotice] = useState("");
  const [highlightedPlayerId, setHighlightedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  }, [game]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!highlightedPlayerId) return;
    const timer = window.setTimeout(() => setHighlightedPlayerId(null), 1200);
    return () => window.clearTimeout(timer);
  }, [highlightedPlayerId]);

  const activeIndex = Math.max(0, game.players.findIndex((p) => p.id === game.activePlayerId));
  const activePlayer = game.players[activeIndex];
  const rankById = useMemo(() => {
    const sorted = [...game.players].sort((a, b) => b.score - a.score);
    return new Map(sorted.map((player, index) => [player.id, index + 1]));
  }, [game.players]);

  function commit(next: GameState, message: string) {
    setUndoState(game);
    setGame(next);
    setNotice(message);
  }

  function adjustCurrent(delta: number) {
    const nextScore = Math.max(0, game.currentScore + delta);
    if (nextScore === game.currentScore) return;
    commit({ ...game, currentScore: nextScore }, `현재 점수 ${formatScore(nextScore)}`);
  }

  function setActive(index: number) {
    const players = game.players;
    if (!players.length) return;
    const normalized = (index + players.length) % players.length;
    setGame({ ...game, activePlayerId: players[normalized].id });
  }

  function awardActive() {
    if (game.currentScore === 0 || !activePlayer) return;
    const awardedScore = game.currentScore;
    const totalAfter = activePlayer.score + awardedScore;
    const log: AwardLog = {
      id: `log-${Date.now()}`,
      playerName: activePlayer.name,
      amount: awardedScore,
      totalAfter,
      createdAt: Date.now(),
    };
    commit(
      {
        ...game,
        logs: [log, ...game.logs],
        players: game.players.map((item) =>
          item.id === activePlayer.id ? { ...item, score: item.score + awardedScore } : item,
        ),
      },
      `${activePlayer.name}에게 ${formatScore(awardedScore)}점 지급`,
    );
    setHighlightedPlayerId(activePlayer.id);
  }

  function saveDirectScore() {
    const parsed = Math.max(0, Number(scoreInput.replaceAll(",", "")) || 0);
    commit({ ...game, currentScore: parsed }, `현재 점수 ${formatScore(parsed)}`);
    setEditingScore(false);
  }

  function resetScores() {
    const next = {
      ...game,
      currentScore: 0,
      logs: [],
      players: game.players.map((player) => ({ ...player, score: 0 })),
      activePlayerId: game.players[0]?.id ?? "",
    };
    commit(next, "모든 점수를 초기화했습니다");
    setRestartOpen(false);
  }

  function updatePlayer(id: string, update: Partial<Player>) {
    setGame({ ...game, players: game.players.map((p) => (p.id === id ? { ...p, ...update } : p)) });
  }

  function removePlayer(id: string) {
    if (game.players.length <= 2) return;
    const players = game.players.filter((p) => p.id !== id);
    setGame({ ...game, players, activePlayerId: players.some((p) => p.id === game.activePlayerId) ? game.activePlayerId : players[0].id });
  }

  function movePlayer(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= game.players.length) return;
    const players = [...game.players];
    [players[index], players[target]] = [players[target], players[index]];
    setGame({ ...game, players });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">GREED DICE / SCORE SHEET</p>
        </div>
        <div className="header-actions">
          <button className="log-button" onClick={() => setLogOpen(true)} aria-label={`점수 지급 로그 ${game.logs.length}건`}>로그{game.logs.length > 0 && <span>{game.logs.length}</span>}</button>
          <button className="undo-button" disabled={!undoState} onClick={() => { if (!undoState) return; setGame(undoState); setUndoState(null); setHighlightedPlayerId(null); setNotice("직전 변경을 되돌렸습니다"); }} aria-label="직전 점수 변경 되돌리기">↶ 되돌리기</button>
          <button className="icon-button" onClick={() => setSetupOpen(true)} aria-label="플레이어 설정">•••</button>
        </div>
      </header>

      <section className="turn-strip" aria-label="진행 순서">
        <button onClick={() => setActive(activeIndex - 1)} aria-label="이전 플레이어">‹</button>
        <div>
          <span>현재 순서</span>
          <strong>{activePlayer?.name ?? "—"}</strong>
        </div>
        <button onClick={() => setActive(activeIndex + 1)} aria-label="다음 플레이어">›</button>
      </section>

      <section className="current-card">
        <span className="section-label">현재 점수</span>
        {editingScore ? (
          <form className="score-edit" onSubmit={(event) => { event.preventDefault(); saveDirectScore(); }}>
            <input inputMode="numeric" value={scoreInput} onChange={(event) => setScoreInput(event.target.value.replace(/[^0-9]/g, ""))} aria-label="현재 점수 직접 입력" />
            <button type="submit">적용</button>
          </form>
        ) : (
          <button className="score-display" onClick={() => { setScoreInput(String(game.currentScore)); setEditingScore(true); }} aria-label={`현재 점수 ${formatScore(game.currentScore)}, 눌러서 수정`}>
            {formatScore(game.currentScore)}
          </button>
        )}
        <div className="adjust-grid">
          <button onClick={() => adjustCurrent(-500)}>−500</button>
          <button onClick={() => adjustCurrent(-50)}>−50</button>
          <button onClick={() => adjustCurrent(50)}>+50</button>
          <button onClick={() => adjustCurrent(500)}>+500</button>
        </div>
      </section>

      <div className="score-actions">
        <button className="award-current-button" disabled={game.currentScore === 0 || !activePlayer} onClick={awardActive}>
          {activePlayer?.name ?? "현재 플레이어"}에게 +{formatScore(game.currentScore)}
        </button>
        <button className="zero-button" disabled={game.currentScore === 0} onClick={() => game.currentScore > 0 && commit({ ...game, currentScore: 0 }, "현재 점수를 0으로 만들었습니다")}>현재 점수 0으로</button>
      </div>

      {notice && <div className="tablet-toast" role="status">{notice}</div>}

      <section className="players-section">
        <div className="column-headings" aria-hidden="true">
          <span>순위</span>
          <span>플레이어</span>
          <span>점수 · {game.players.length}명</span>
        </div>
        <div className="player-list">
          {game.players.map((player) => (
            <article key={player.id} className={`player-card ${player.id === game.activePlayerId ? "active" : ""}`}>
              <button className="player-main" onClick={() => setGame({ ...game, activePlayerId: player.id })} aria-label={`${player.name}을 현재 순서로 선택`}>
                <span className="rank">{rankById.get(player.id)}위</span>
                <strong className="player-name">{player.name}</strong>
                <span className={`player-score ${player.id === highlightedPlayerId ? "score-updated" : ""}`}>{formatScore(player.score)}</span>
              </button>
            </article>
          ))}
        </div>
      </section>

      {logOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal log-modal" role="dialog" aria-modal="true" aria-labelledby="log-title">
            <div className="modal-header">
              <div><p className="eyebrow">THIS GAME</p><h2 id="log-title">점수 지급 로그</h2></div>
              <button className="icon-button" onClick={() => setLogOpen(false)} aria-label="로그 닫기">×</button>
            </div>
            {game.logs.length === 0 ? (
              <p className="empty-log">아직 지급된 점수가 없습니다.</p>
            ) : (
              <ol className="log-list">
                {game.logs.map((log) => (
                  <li key={log.id}>
                    <time dateTime={new Date(log.createdAt).toISOString()}>{formatTime(log.createdAt)}</time>
                    <strong>{log.playerName}</strong>
                    <div><b>+{formatScore(log.amount)}</b><span>누적 {formatScore(log.totalAfter)}</span></div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      {setupOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="setup-title">
            <div className="modal-header">
              <div><p className="eyebrow">SETUP</p><h2 id="setup-title">플레이어 설정</h2></div>
              <button className="icon-button" onClick={() => setSetupOpen(false)} aria-label="설정 닫기">×</button>
            </div>
            <div className="setup-list">
              {game.players.map((player, index) => (
                <div className="setup-row" key={player.id}>
                  <span>{index + 1}</span>
                  <input value={player.name} maxLength={16} onChange={(event) => updatePlayer(player.id, { name: event.target.value })} aria-label={`${index + 1}번 플레이어 이름`} />
                  <div className="row-actions">
                    <button onClick={() => movePlayer(index, -1)} disabled={index === 0} aria-label="위로 이동">↑</button>
                    <button onClick={() => movePlayer(index, 1)} disabled={index === game.players.length - 1} aria-label="아래로 이동">↓</button>
                    <button onClick={() => removePlayer(player.id)} disabled={game.players.length <= 2} aria-label="플레이어 삭제">×</button>
                  </div>
                </div>
              ))}
            </div>
            <button className="add-player" onClick={() => setGame({ ...game, players: [...game.players, { id: makeId(), name: `플레이어 ${game.players.length + 1}`, score: 0 }] })}>+ 플레이어 추가</button>
            <button className="primary-button" onClick={() => setSetupOpen(false)}>완료</button>
            <button className="restart-link" onClick={() => { setSetupOpen(false); setRestartOpen(true); }}>다시 하기</button>
          </section>
        </div>
      )}

      {restartOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="restart-title">
            <span className="warning-mark">!</span>
            <h2 id="restart-title">점수를 모두 지울까요?</h2>
            <p>플레이어 이름과 순서는 유지되고, 모든 점수와 이번 판의 지급 로그가 초기화됩니다.</p>
            <div className="confirm-actions">
              <button onClick={() => setRestartOpen(false)}>취소</button>
              <button className="danger-button" onClick={resetScores}>모든 점수 초기화</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
