"use client";

import { useEffect, useState } from "react";
import { database } from "../lib/firebase";
import { get, onValue, ref, set, update } from "firebase/database";

type Screen = "home" | "create" | "join" | "name" | "lobby" | "game";

type Player = {
  name: string;
  sheep: number;
  eliminated: boolean;
};

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");

  const [players, setPlayers] = useState<string[]>([]);
  const [playerOrder, setPlayerOrder] = useState<string[]>([]);
  const [playerScores, setPlayerScores] = useState<Record<string, Player>>({});
  const [hostName, setHostName] = useState("");

  const [shepherd, setShepherd] = useState("");
  const [mySheep, setMySheep] = useState(7);
  const [currentCard, setCurrentCard] = useState("");
  const [shout, setShout] = useState("");
  const [phase, setPhase] = useState("");
  const [roundInTurn, setRoundInTurn] = useState(1);

  const [betChoice, setBetChoice] = useState("");
  const [betAmount, setBetAmount] = useState(1);

  const [isTruth, setIsTruth] = useState<boolean | null>(null);
  const [winner, setWinner] = useState("");
  const [specialEvent, setSpecialEvent] = useState("");

  useEffect(() => {
    if (!roomCode) return;

    const roomRef = ref(database, `rooms/${roomCode}`);

    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      if (data.players) {
        const list = Object.values(data.players).map((p: any) => p.name);
        setPlayers(list);
        setPlayerScores(data.players);

        if (playerName && data.players[playerName]) {
          setMySheep(data.players[playerName].sheep ?? 7);
        }
      } else {
        setPlayers([]);
        setPlayerScores({});
      }

      setPlayerOrder(data.playerOrder || []);
      setHostName(data.hostName || "");
      setShepherd(data.shepherd || "");
      setCurrentCard(data.currentCard || "");
      setShout(data.shout || "");
      setRoundInTurn(data.roundInTurn || 1);
      setSpecialEvent(data.specialEvent || "");
      setWinner(data.winner || "");

      if (data.phase) {
        setPhase(data.phase);

        if (data.phase === "draw" || data.phase === "shout") {
          setBetChoice("");
          setBetAmount(1);
        }
      }

      if (typeof data.isTruth === "boolean") {
        setIsTruth(data.isTruth);
      } else {
        setIsTruth(null);
      }

      if (data.status === "playing" || data.status === "finished") {
        setScreen("game");
      }
    });

    return () => unsubscribe();
  }, [roomCode, playerName]);

  const resetToHome = () => {
    setScreen("home");
    setRoomCode("");
    setPlayerName("");
    setPlayers([]);
    setPlayerOrder([]);
    setPlayerScores({});
    setHostName("");
    setShepherd("");
    setMySheep(7);
    setCurrentCard("");
    setShout("");
    setPhase("");
    setRoundInTurn(1);
    setBetChoice("");
    setBetAmount(1);
    setIsTruth(null);
    setWinner("");
    setSpecialEvent("");
  };

  const createRoom = async () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();

    await set(ref(database, `rooms/${code}`), {
      roomCode: code,
      status: "lobby",
      createdAt: Date.now(),
      currentRound: 1,
      currentTurn: 0,
      roundInTurn: 1,
      phase: "lobby",
      hostName: "",
      players: {},
      playerOrder: [],
    });

    setRoomCode(code);
    setScreen("name");
  };

  const joinRoom = async () => {
    if (!roomCode.trim()) return;

    const cleanCode = roomCode.trim();
    const roomSnapshot = await get(ref(database, `rooms/${cleanCode}`));

    if (!roomSnapshot.exists()) {
      alert("존재하지 않는 방입니다.");
      return;
    }

    setRoomCode(cleanCode);
    setScreen("name");
  };

  const enterLobby = async () => {
    const name = playerName.trim();
    if (!name) return;

    const roomSnapshot = await get(ref(database, `rooms/${roomCode}`));
    const room = roomSnapshot.val();

    if (!room) {
      alert("존재하지 않는 방입니다.");
      return;
    }

    if (room.players && room.players[name]) {
      alert("이미 사용 중인 이름입니다.");
      return;
    }

    const isFirstPlayer =
      !room.players || Object.keys(room.players).length === 0;

    await set(ref(database, `rooms/${roomCode}/players/${name}`), {
      name,
      sheep: 7,
      eliminated: false,
    });

    if (isFirstPlayer) {
      await update(ref(database, `rooms/${roomCode}`), {
        hostName: name,
      });
    }

    setPlayerName(name);
    setScreen("lobby");
  };

  const startGame = async () => {
    if (playerName !== hostName) return;

    if (players.length < 2) {
      alert("최소 2명 이상 필요합니다.");
      return;
    }

    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);

    const playerData: Record<string, Player> = {};

    shuffledPlayers.forEach((player) => {
      playerData[player] = {
        name: player,
        sheep: 7,
        eliminated: false,
      };
    });

    await update(ref(database, `rooms/${roomCode}`), {
      status: "playing",
      currentRound: 1,
      currentTurn: 0,
      roundInTurn: 1,
      phase: "draw",
      shepherd: shuffledPlayers[0],
      playerOrder: shuffledPlayers,
      players: playerData,
      currentCard: null,
      shout: null,
      bets: null,
      isTruth: null,
      specialEvent: null,
      winner: null,
    });
  };

  const drawCard = async () => {
    if (playerName !== shepherd) return;

    const card = Math.random() < 0.5 ? "평화" : "늑대";

    await update(ref(database, `rooms/${roomCode}`), {
      currentCard: card,
      phase: "shout",
    });
  };

  const makeShout = async (selectedShout: "평화" | "늑대") => {
    if (playerName !== shepherd) return;

    await update(ref(database, `rooms/${roomCode}`), {
      shout: selectedShout,
      phase: "betting",
      bets: null,
    });

    setBetChoice("");
    setBetAmount(1);
  };

  const submitBet = async (choice: "신뢰" | "불신") => {
    if (!playerName || playerName === shepherd) return;

    const safeAmount = Math.min(betAmount, mySheep, 5);

    if (safeAmount <= 0) {
      alert("베팅할 양이 없습니다.");
      return;
    }

    await set(ref(database, `rooms/${roomCode}/bets/${playerName}`), {
      name: playerName,
      choice,
      amount: safeAmount,
    });

    setBetAmount(safeAmount);
    setBetChoice(choice);
  };

  const calculateResult = async () => {
    if (playerName !== shepherd) return;

    const roomSnapshot = await get(ref(database, `rooms/${roomCode}`));
    const room = roomSnapshot.val();
    if (!room) return;

    const card = room.currentCard;
    const roomShout = room.shout;
    const roomShepherd = room.shepherd;
    const roomPlayers = room.players || {};
    const roomBets = room.bets || {};

    const updatedPlayers: Record<string, Player> = JSON.parse(
      JSON.stringify(roomPlayers)
    );

    const activeResidents = Object.keys(roomPlayers).filter(
      (name) => name !== roomShepherd && !roomPlayers[name].eliminated
    );

    const allBetted = activeResidents.every((name) => roomBets[name]);

    if (!allBetted) {
      alert("아직 모든 주민이 베팅하지 않았습니다.");
      return;
    }

    const truth = card === roomShout;
    const totalResidents = activeResidents.length;

    const trustCount = Object.values(roomBets).filter(
      (bet: any) => bet.choice === "신뢰"
    ).length;

    const distrustCount = Object.values(roomBets).filter(
      (bet: any) => bet.choice === "불신"
    ).length;

    let eventName = "";
    let skipBasic = false;

    if (truth && trustCount === totalResidents) {
      eventName = "완벽한 진실 성공";
      skipBasic = true;
    }

    if (
      card === "늑대" &&
      roomShout === "늑대" &&
      distrustCount === totalResidents
    ) {
      eventName = "완벽한 진실 실패";
      skipBasic = true;
      updatedPlayers[roomShepherd].sheep = 0;
      updatedPlayers[roomShepherd].eliminated = true;
    }

    if (
      card === "늑대" &&
      roomShout === "평화" &&
      trustCount === totalResidents
    ) {
      eventName = "완벽한 거짓 성공";
      skipBasic = true;

      Object.values(roomBets).forEach((bet: any) => {
        updatedPlayers[bet.name].sheep -= bet.amount * 2;
        updatedPlayers[roomShepherd].sheep += bet.amount * 2;
      });
    }

    if (
      card === "평화" &&
      roomShout === "늑대" &&
      distrustCount === totalResidents
    ) {
      eventName = "완벽한 거짓 실패";
      skipBasic = true;
      updatedPlayers[roomShepherd].sheep -= 1;
    }

    if (!skipBasic) {
      Object.values(roomBets).forEach((bet: any) => {
        const name = bet.name;
        const amount = bet.amount;

        if (truth) {
          if (bet.choice === "신뢰") {
            updatedPlayers[name].sheep += amount;
          } else {
            updatedPlayers[name].sheep -= amount;
          }
        } else {
          if (bet.choice === "신뢰") {
            updatedPlayers[name].sheep -= amount;
            updatedPlayers[roomShepherd].sheep += amount;
          } else {
            updatedPlayers[name].sheep += amount;
          }
        }
      });
    }

    Object.keys(updatedPlayers).forEach((name) => {
      if (updatedPlayers[name].sheep <= 0) {
        updatedPlayers[name].sheep = 0;
        updatedPlayers[name].eliminated = true;
      }
    });

    await update(ref(database, `rooms/${roomCode}`), {
      players: updatedPlayers,
      phase: "result",
      isTruth: truth,
      specialEvent: eventName,
    });
  };

  const nextRound = async () => {
    if (playerName !== shepherd) return;

    const order = playerOrder.length > 0 ? playerOrder : players;

    const alivePlayers = order.filter((p) => !playerScores[p]?.eliminated);

    if (alivePlayers.length <= 1) {
      await update(ref(database, `rooms/${roomCode}`), {
        status: "finished",
        phase: "finished",
        winner: alivePlayers[0] || shepherd,
      });
      return;
    }

    let nextShepherd = shepherd;
    let nextRoundInTurn = roundInTurn + 1;

    if (nextRoundInTurn > 3) {
      const currentIndex = alivePlayers.indexOf(shepherd);
      const nextIndex = currentIndex + 1;

      if (nextIndex >= alivePlayers.length) {
        const finalPlayers = Object.values(playerScores);
        const winnerPlayer = finalPlayers.reduce((top, player) =>
          player.sheep > top.sheep ? player : top
        );

        await update(ref(database, `rooms/${roomCode}`), {
          status: "finished",
          phase: "finished",
          winner: winnerPlayer.name,
        });

        return;
      }

      nextShepherd = alivePlayers[nextIndex];
      nextRoundInTurn = 1;
    }

    await update(ref(database, `rooms/${roomCode}`), {
      shepherd: nextShepherd,
      roundInTurn: nextRoundInTurn,
      currentCard: null,
      shout: null,
      bets: null,
      phase: "draw",
      isTruth: null,
      specialEvent: null,
    });

    setBetChoice("");
    setBetAmount(1);
  };

  const inputClass =
    "w-full rounded-2xl bg-white border border-white/30 px-4 py-4 text-black placeholder-gray-500 text-lg mb-4";

  const orderedPlayers =
    playerOrder.length > 0 ? playerOrder : players;

  if (screen === "create") {
    return (
      <main className="min-h-screen bg-green-950 text-white px-6 py-10">
        <button
          onClick={() => setScreen("home")}
          className="mb-8 text-green-200"
        >
          ← 뒤로
        </button>

        <h1 className="text-3xl font-bold mb-4">방 만들기</h1>
        <p className="text-green-100 mb-8">
          친구들이 들어올 방을 만듭니다.
        </p>

        <button
          onClick={createRoom}
          className="w-full rounded-2xl bg-white text-green-950 py-4 text-lg font-bold"
        >
          새 방 생성
        </button>
      </main>
    );
  }

  if (screen === "join") {
    return (
      <main className="min-h-screen bg-green-950 text-white px-6 py-10">
        <button
          onClick={() => setScreen("home")}
          className="mb-8 text-green-200"
        >
          ← 뒤로
        </button>

        <h1 className="text-3xl font-bold mb-4">방 참가하기</h1>

        <input
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          className={inputClass}
          placeholder="방 코드 입력"
        />

        <button
          onClick={joinRoom}
          className="w-full rounded-2xl bg-white text-green-950 py-4 text-lg font-bold"
        >
          다음
        </button>
      </main>
    );
  }

  if (screen === "name") {
    return (
      <main className="min-h-screen bg-green-950 text-white px-6 py-10">
        <button
          onClick={() => setScreen("home")}
          className="mb-8 text-green-200"
        >
          ← 처음으로
        </button>

        <p className="text-green-200 mb-2">방 코드</p>
        <div className="text-5xl font-bold tracking-widest mb-10 text-white">
          {roomCode}
        </div>

        <h1 className="text-3xl font-bold mb-4">이름 입력</h1>

        <input
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          className={inputClass}
          placeholder="예: 용하"
        />

        <button
          onClick={enterLobby}
          className="w-full rounded-2xl bg-white text-green-950 py-4 text-lg font-bold"
        >
          대기방 입장
        </button>
      </main>
    );
  }

  if (screen === "lobby") {
    return (
      <main className="min-h-screen bg-green-950 text-white px-6 py-10">
        <p className="text-green-200 mb-2">방 코드</p>
        <div className="text-5xl font-bold tracking-widest mb-8 text-white">
          {roomCode}
        </div>

        <h1 className="text-3xl font-bold mb-2">대기방</h1>

        <p className="text-green-100 mb-2">
          현재 참가자: {players.length}명
        </p>

        <p className="text-green-100 mb-6">
          방장: {hostName || "아직 없음"}
        </p>

        <div className="space-y-3 mb-8">
          {players.map((player) => (
            <div
              key={player}
              className="rounded-2xl bg-white/10 px-4 py-4 text-lg"
            >
              🐑 {player}
              {player === hostName ? " 👑" : ""}
            </div>
          ))}
        </div>

        {playerName === hostName ? (
          <button
            onClick={startGame}
            className="w-full rounded-2xl bg-white text-green-950 py-4 text-lg font-bold"
          >
            게임 시작
          </button>
        ) : (
          <p className="text-green-100 text-center">
            방장이 게임을 시작할 때까지 기다리세요.
          </p>
        )}
      </main>
    );
  }

  if (screen === "game") {
    const isShepherd = playerName === shepherd;
    const maxBet = Math.max(1, Math.min(5, mySheep));

    if (phase === "finished") {
      return (
        <main className="min-h-screen bg-green-950 text-white px-6 py-10">
          <h1 className="text-4xl font-bold mb-4">게임 종료</h1>

          <div className="rounded-2xl bg-yellow-300 text-green-950 p-6 mb-6">
            <p className="text-lg font-bold mb-2">우승자</p>
            <h2 className="text-5xl font-bold">🏆 {winner}</h2>
          </div>

          <div className="space-y-3">
            {orderedPlayers.map((name) => {
              const player = playerScores[name];
              if (!player) return null;

              return (
                <div
                  key={player.name}
                  className="flex justify-between rounded-2xl bg-white/10 px-4 py-4"
                >
                  <span>
                    {player.eliminated ? "💀" : "🐑"} {player.name}
                  </span>
                  <span className="font-bold">{player.sheep}마리</span>
                </div>
              );
            })}
          </div>

          <button
            onClick={resetToHome}
            className="w-full rounded-2xl bg-white text-green-950 py-4 text-lg font-bold mt-8"
          >
            홈으로 돌아가기
          </button>
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-green-950 text-white px-6 py-10 pb-32">
        <p className="text-green-200 mb-2">방 코드</p>
        <div className="text-4xl font-bold tracking-widest mb-6 text-white">
          {roomCode}
        </div>

        <div className="rounded-2xl bg-white/10 p-5 mb-6">
          <p className="text-green-200 mb-3">플레이어 순서</p>

          <div className="space-y-2">
            {orderedPlayers.map((name, index) => {
              const player = playerScores[name];
              if (!player) return null;

              return (
                <div
                  key={name}
                  className={`flex justify-between items-center rounded-2xl px-4 py-3 ${
                    name === shepherd
                      ? "bg-yellow-300 text-green-950"
                      : "bg-white/10 text-white"
                  }`}
                >
                  <span className="font-bold">
                    {index + 1}. {name === shepherd ? "🧑‍🌾" : "🐑"} {name}
                  </span>

                  <span className="font-bold">
                    {player.eliminated ? "탈락" : `${player.sheep}마리`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-white/10 p-5 mb-6">
          <p className="text-green-200 mb-2">현재 양치기</p>
          <h2 className="text-3xl font-bold">{shepherd}</h2>
          <p className="mt-3 text-xl">외침 {roundInTurn} / 3</p>
        </div>

        {phase === "result" && (
          <div className="rounded-2xl bg-yellow-300 text-green-950 p-5 mb-6">
            <p className="text-lg font-bold mb-2">결과</p>

            <h2 className="text-3xl font-bold mb-5">
              {isTruth ? "진실이었습니다" : "거짓이었습니다"}
            </h2>

            {specialEvent && (
              <div className="rounded-2xl bg-red-500 text-white p-4 mb-5 text-center text-xl font-bold">
                {specialEvent}
              </div>
            )}

            <div className="space-y-3">
              {orderedPlayers.map((name) => {
                const player = playerScores[name];
                if (!player) return null;

                return (
                  <div
                    key={player.name}
                    className="flex justify-between rounded-xl bg-white/60 px-4 py-3"
                  >
                    <span>
                      {player.eliminated ? "💀" : "🐑"} {player.name}
                    </span>
                    <span className="font-bold">{player.sheep}마리</span>
                  </div>
                );
              })}
            </div>

            {isShepherd && (
              <button
                onClick={nextRound}
                className="w-full rounded-2xl bg-green-950 text-white py-4 text-lg font-bold mt-6"
              >
                다음 라운드
              </button>
            )}
          </div>
        )}

        {isShepherd ? (
          <div>
            <h2 className="text-2xl font-bold mb-4">당신은 양치기입니다.</h2>

            {!currentCard ? (
              <button
                onClick={drawCard}
                className="w-full rounded-2xl bg-white text-green-950 py-4 text-lg font-bold"
              >
                카드 뽑기
              </button>
            ) : (
              <div className="rounded-2xl bg-white text-green-950 p-6 text-center">
                <p className="text-lg mb-2">뽑은 카드</p>
                <div className="text-5xl font-bold">{currentCard}</div>

                {!shout && (
                  <div className="mt-6 flex flex-col gap-3">
                    <button
                      onClick={() => makeShout("늑대")}
                      className="w-full rounded-2xl bg-green-950 text-white py-4 text-lg font-bold"
                    >
                      늑대가 왔다!
                    </button>

                    <button
                      onClick={() => makeShout("평화")}
                      className="w-full rounded-2xl border border-green-950 py-4 text-lg font-bold"
                    >
                      평화롭다
                    </button>
                  </div>
                )}

                {shout && (
                  <p className="mt-6 text-2xl font-bold">
                    외침: {shout === "늑대" ? "늑대가 왔다!" : "평화롭다!"}
                  </p>
                )}
              </div>
            )}

            {phase === "betting" && (
              <button
                onClick={calculateResult}
                className="w-full rounded-2xl bg-yellow-300 text-green-950 py-4 text-lg font-bold mt-6"
              >
                결과 계산
              </button>
            )}
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold mb-4">당신은 주민입니다.</h2>

            {!shout ? (
              <p className="text-green-100">양치기의 외침을 기다리세요.</p>
            ) : betChoice ? (
              <div className="rounded-2xl bg-white/10 p-5">
                <p className="text-green-200 mb-2">베팅 완료</p>
                <p className="text-2xl font-bold">
                  {betChoice} / 양 {betAmount}마리
                </p>
              </div>
            ) : (
              <div>
                <div className="rounded-2xl bg-white/10 p-5 mb-6">
                  <p className="text-green-200 mb-2">양치기의 외침</p>
                  <h2 className="text-4xl font-bold">
                    {shout === "늑대" ? "늑대가 왔다!" : "평화롭다!"}
                  </h2>
                </div>

                <p className="mb-3 text-green-100">몇 마리를 걸까요?</p>

                <div className="grid grid-cols-5 gap-2 mb-6">
                  {Array.from({ length: maxBet }, (_, i) => i + 1).map(
                    (amount) => (
                      <button
                        key={amount}
                        onClick={() => setBetAmount(amount)}
                        className={`rounded-xl py-3 font-bold ${
                          betAmount === amount
                            ? "bg-white text-green-950"
                            : "bg-white/10 text-white"
                        }`}
                      >
                        {amount}
                      </button>
                    )
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => submitBet("신뢰")}
                    className="w-full rounded-2xl bg-white text-green-950 py-4 text-lg font-bold"
                  >
                    신뢰
                  </button>

                  <button
                    onClick={() => submitBet("불신")}
                    className="w-full rounded-2xl border border-white/40 py-4 text-lg font-bold"
                  >
                    불신
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 bg-green-950 border-t border-white/20 p-4">
          <div className="mx-auto max-w-md rounded-2xl bg-white/10 p-4">
            <div className="flex justify-between">
              <span className="text-green-200">내 이름</span>
              <span className="font-bold">{playerName}</span>
            </div>

            <div className="flex justify-between mt-2">
              <span className="text-green-200">내 양</span>
              <span className="font-bold">🐑 {mySheep}마리</span>
            </div>

            <div className="flex justify-between mt-2">
              <span className="text-green-200">내 역할</span>
              <span className="font-bold">
                {isShepherd ? "양치기" : "주민"}
              </span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-green-950 text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="text-6xl mb-6">🐑</div>

        <h1 className="text-4xl font-bold mb-3">양치기 게임</h1>

        <p className="text-green-100 mb-10 leading-relaxed">
          양치기 소년의 외침을 믿을지, 의심할지 선택하세요.
        </p>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => setScreen("create")}
            className="w-full rounded-2xl bg-white text-green-950 py-4 text-lg font-bold"
          >
            방 만들기
          </button>

          <button
            onClick={() => setScreen("join")}
            className="w-full rounded-2xl border border-white/40 py-4 text-lg font-bold"
          >
            방 참가하기
          </button>
        </div>
      </div>
    </main>
  );
}