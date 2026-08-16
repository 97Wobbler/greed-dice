"use client";

import { useEffect, useMemo, useState } from "react";

type Player = { id: string; name: string; score: number };
type GameState = { players: Player[]; activePlayerId: string; currentScore: number };

const STORAGE_KEY = "greed-dice-scoreboard-v1";
const initialState: GameState = {
  players: [
    { id: "player-1", name: "플레이어 1", score: 0 },
    { id: "player-2", name: "플레이어 2", score: 0 },
  ],
  activePlayerId: "player-1",
  currentScore: 0,
};

const formatScore = (score: number) => score.toLocaleString("ko-KR");
const makeId = () => `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function loadGame(): GameState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as GameState) : initialState;
  } catch {
    return initialState;
  }
}

export default function Home() {
  const [game, setGame] = useState<GameState>(loadGame);
  const [setupOpen, setSetupOpen] = useState(() => !localStorage.getItem(STORAGE_KEY));
  const [restartOpen, setRestartOpen] = useState(false);
  const [editingScore, setEditingScore] = useState(false);
  const [scoreInput, setScoreInput] = useState("0");
  const [undoState, setUndoState] = useState<GameState | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  }, [game]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const activeIndex = Math.max(0, game.players.findIndex((p) => p.id === game.activePlayerId));
  const activePlayer = game.players[activeIndex];
  const rankById = useMemo(() => {
    const sorted = [...game.players].sort((a, b) => b.score - a.score);
    return new Map(sorted.map((player, index) => [player.id, index + 1]));
  }, [game.players]);

  function commit(next: GameState, message = "변경했습니다") {
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

  function award(player: Player) {
    if (game.currentScore === 0) return;
    commit(
      {
        ...game,
        players: game.players.map((item) =>
          item.id === player.id ? { ...item, score: item.score + game.currentScore } : item,
        ),
      },
      `${player.name}에게 +${formatScore(game.currentScore)}`,
    );
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
          <p className="eyebrow">GREED DICE</p>
          <h1>점수판</h1>
        </div>
        <button className="icon-button" onClick={() => setSetupOpen(true)} aria-label="플레이어 설정">•••</button>
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
        <button className="zero-button" onClick={() => game.currentScore > 0 && commit({ ...game, currentScore: 0 }, "현재 점수를 0으로 만들었습니다")}>현재 점수 0으로</button>
      </section>

      <section className="players-section">
        <div className="section-heading">
          <h2>플레이어</h2>
          <span>{game.players.length}명</span>
        </div>
        <div className="player-list">
          {game.players.map((player, index) => (
            <article key={player.id} className={`player-card ${player.id === game.activePlayerId ? "active" : ""}`}>
              <button className="player-main" onClick={() => setGame({ ...game, activePlayerId: player.id })} aria-label={`${player.name}을 현재 순서로 선택`}>
                <span className="order">{index + 1}</span>
                <div className="player-info">
                  <strong>{player.name}</strong>
                  <span>{rankById.get(player.id)}위</span>
                </div>
                <span className="player-score">{formatScore(player.score)}</span>
              </button>
              <button className="award-button" disabled={game.currentScore === 0} onClick={(event) => { event.stopPropagation(); award(player); }}>
                {player.name}에게 +{formatScore(game.currentScore)}
              </button>
            </article>
          ))}
        </div>
      </section>

      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          {undoState && <button onClick={() => { setGame(undoState); setUndoState(null); setNotice("되돌렸습니다"); }}>되돌리기</button>}
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
            <p>플레이어 이름과 순서는 유지되고, 모든 점수만 0으로 초기화됩니다.</p>
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
