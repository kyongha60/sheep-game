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

type Bet = {
  name: string;
  choice: "신뢰" | "불신";
  amount: number;
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
  const [currentRound, setCurrentRound] = useState(1);
  const [roundInTurn, setRoundInTurn] = useState(1);

  const [totalRounds, setTotalRounds] = useState(7);
  const [shoutsPerTurn, setShoutsPerTurn] = useState(3);
  const [startingSheep, setStartingSheep] = useState(7);

  const [trustAmount, setTrustAmount] = useState(0);
  const [distrustAmount, setDistrustAmount] = useState(0);
  const [bets, setBets] = useState<Record<string, Bet>>({});

  const [isTruth, setIsTruth] = useState<boolean | null>(null);
  const [winner, setWinner] = useState("");
  const [specialEvent, setSpecialEvent] = useState("");
  const [resultChanges, setResultChanges] = useState<Record<string, number>>({});

  const [showHistory, setShowHistory] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [shoutHistory, setShoutHistory] = useState<
    Record<string, Record<string, string>>
  >({});

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
          setMySheep(data.players[playerName].sheep ?? startingSheep);
        }
      } else {
        setPlayers([]);
        setPlayerScores({});
      }

      if (data.settings) {
        setTotalRounds(data.settings.totalRounds ?? 7);
        setShoutsPerTurn(data.settings.shoutsPerTurn ?? 3);
        setStartingSheep(data.settings.startingSheep ?? 7);
      }

      setPlayerOrder(data.playerOrder || []);
      setHostName(data.hostName || "");
      setShepherd(data.shepherd || "");
      setCurrentCard(data.currentCard || "");
      setShout(data.shout || "");
      setCurrentRound(data.currentRound || 1);
      setRoundInTurn(data.roundInTurn || 1);
      setSpecialEvent(data.specialEvent || "");
      setWinner(data.winner || "");
      setBets(data.bets || {});
      setResultChanges(data.resultChanges || {});
      setShoutHistory(data.shoutHistory || {});

      if (data.phase) {
        setPhase(data.phase);

        if (data.phase === "draw" || data.phase === "shout") {
          setTrustAmount(0);
          setDistrustAmount(0);
        }
      } else {
        setPhase("");
      }

      if (typeof data.isTruth === "boolean") setIsTruth(data.isTruth);
      else setIsTruth(null);

      if (data.status === "playing" || data.status === "finished") {
        setScreen("game");
      }
    });

    return () => unsubscribe();
  }, [roomCode, playerName, startingSheep]);

  const resetToHome = () => {
    setScreen("home");
    setRoomCode("");
    setPlayerName("");
    setPlayers([]);
    setPlayerOrder([]);
    setPlayerScores({});
    setHostName("");
    setShepherd("");
    setMySheep(startingSheep);
    setCurrentCard("");
    setShout("");
    setPhase("");
    setCurrentRound(1);
    setRoundInTurn(1);
    setTrustAmount(0);
    setDistrustAmount(0);
    setBets({});
    setIsTruth(null);
    setWinner("");
    setSpecialEvent("");
    setResultChanges({});
    setShowHistory(false);
    setShowRules(false);
    setShoutHistory({});
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
      settings: {
        totalRounds,
        shoutsPerTurn,
        startingSheep,
      },
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

    const roomStartingSheep = room.settings?.startingSheep ?? startingSheep;
    const isFirstPlayer = !room.players || Object.keys(room.players).length === 0;

    await set(ref(database, `rooms/${roomCode}/players/${name}`), {
      name,
      sheep: roomStartingSheep,
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
        sheep: startingSheep,
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
      resultChanges: null,
      shoutHistory: null,
      settings: {
        totalRounds,
        shoutsPerTurn,
        startingSheep,
      },
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
      [`shoutHistory/${shepherd}/${roundInTurn}`]: selectedShout,
    });

    setTrustAmount(0);
    setDistrustAmount(0);
  };

  const submitBet = async () => {
    if (!playerName || playerName === shepherd) return;

    const choice = trustAmount > 0 ? "신뢰" : "불신";
    const amount = trustAmount > 0 ? trustAmount : distrustAmount;

    if (amount <= 0) {
      alert("양을 최소 1마리 이상 걸어야 합니다.");
      return;
    }

    const safeAmount = Math.min(amount, mySheep, 5);

    await set(ref(database, `rooms/${roomCode}/bets/${playerName}`), {
      name: playerName,
      choice,
      amount: safeAmount,
    });
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

    const beforeSheep: Record<string, number> = {};
    Object.keys(roomPlayers).forEach((name) => {
      beforeSheep[name] = roomPlayers[name].sheep;
    });

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

    if (truth && trustCount === totalResidents && totalResidents >= 2) {
      eventName = "완벽한 진실의 성공";
      skipBasic = true;
    }

    if (
      card === "늑대" &&
      roomShout === "늑대" &&
      distrustCount === totalResidents &&
      totalResidents >= 2
    ) {
      eventName = "완벽한 진실의 실패";
      skipBasic = true;
      updatedPlayers[roomShepherd].sheep = 0;
      updatedPlayers[roomShepherd].eliminated = true;
    }

    if (
      card === "늑대" &&
      roomShout === "평화" &&
      trustCount === totalResidents &&
      totalResidents >= 2
    ) {
      eventName = "완벽한 거짓의 성공";
      skipBasic = true;

      Object.values(roomBets).forEach((bet: any) => {
        updatedPlayers[bet.name].sheep -= bet.amount * 2;
        updatedPlayers[roomShepherd].sheep += bet.amount * 2;
      });
    }

    if (
      card === "평화" &&
      roomShout === "늑대" &&
      distrustCount === totalResidents &&
      totalResidents >= 2
    ) {
      eventName = "완벽한 거짓의 실패";
      skipBasic = true;
      updatedPlayers[roomShepherd].sheep -= 1;
    }

    if (!skipBasic) {
      Object.values(roomBets).forEach((bet: any) => {
        const name = bet.name;
        const amount = bet.amount;

        if (truth) {
          if (bet.choice === "신뢰") updatedPlayers[name].sheep += amount;
          else updatedPlayers[name].sheep -= amount;
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

    const resultChanges: Record<string, number> = {};
    Object.keys(updatedPlayers).forEach((name) => {
      resultChanges[name] = updatedPlayers[name].sheep - beforeSheep[name];
    });

    await update(ref(database, `rooms/${roomCode}`), {
      players: updatedPlayers,
      phase: "result",
      isTruth: truth,
      specialEvent: eventName,
      resultChanges,
    });

    setPlayerScores(updatedPlayers);

    if (updatedPlayers[playerName]) {
      setMySheep(updatedPlayers[playerName].sheep);
    }
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
    let nextCurrentRound = currentRound;

    if (nextRoundInTurn > shoutsPerTurn) {
      if (currentRound >= totalRounds) {
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

      const currentIndex = alivePlayers.indexOf(shepherd);
      const nextIndex = (currentIndex + 1) % alivePlayers.length;

      nextShepherd = alivePlayers[nextIndex];
      nextRoundInTurn = 1;
      nextCurrentRound = currentRound + 1;
    }

    await update(ref(database, `rooms/${roomCode}`), {
      shepherd: nextShepherd,
      roundInTurn: nextRoundInTurn,
      currentRound: nextCurrentRound,
      currentCard: null,
      shout: null,
      bets: null,
      phase: "draw",
      isTruth: null,
      specialEvent: null,
      resultChanges: null,
    });

    setTrustAmount(0);
    setDistrustAmount(0);
  };

  const inputClass =
    "w-full rounded-2xl bg-white border border-white/30 px-4 py-4 text-black placeholder-gray-500 text-lg mb-4";

  const orderedPlayers = playerOrder.length > 0 ? playerOrder : players;

  if (screen === "game") {
    const isShepherd = playerName === shepherd;
    const maxBet = Math.max(1, Math.min(5, mySheep));

    const previewBets: Record<string, Bet> = { ...bets };

    if (!isShepherd && !bets[playerName]) {
      if (trustAmount > 0) {
        previewBets[playerName] = {
          name: playerName,
          choice: "신뢰",
          amount: trustAmount,
        };
      }

      if (distrustAmount > 0) {
        previewBets[playerName] = {
          name: playerName,
          choice: "불신",
          amount: distrustAmount,
        };
      }
    }

    const totalTrust = Object.values(previewBets)
      .filter((bet: any) => bet.choice === "신뢰")
      .reduce((sum: number, bet: any) => sum + bet.amount, 0);

    const totalDistrust = Object.values(previewBets)
      .filter((bet: any) => bet.choice === "불신")
      .reduce((sum: number, bet: any) => sum + bet.amount, 0);

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
      <main className="min-h-screen bg-green-950 text-white px-6 py-6 pb-24">
        <div className="flex justify-end gap-2 mb-3">
          <button
            onClick={() => setShowRules(!showRules)}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold"
          >
            {showRules ? "룰 닫기" : "룰 설명"}
          </button>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold"
          >
            {showHistory ? "기록 닫기" : "기록 보기"}
          </button>
        </div>

        {showRules && (
          <div className="rounded-2xl bg-white text-green-950 p-4 mb-5 text-sm leading-relaxed">
            <h2 className="text-xl font-bold mb-4">룰 설명</h2>

            <div className="mb-4">
              <h3 className="font-bold text-lg mb-2">기본 결과</h3>
              <p className="mb-2">
                외침이 <span className="font-bold text-blue-700">진실</span>이면
                신뢰한 주민은 건 만큼 양을 받고, 불신한 주민은 건 만큼 양을 잃습니다.
              </p>
              <p>
                외침이 <span className="font-bold text-red-700">거짓</span>이면
                신뢰한 주민은 건 만큼 양을 양치기에게 빼앗기고, 불신한 주민은 건 만큼 양을 받습니다.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-2">특수 룰</h3>

              <div className="space-y-3">
                <div className="rounded-xl bg-green-100 p-3">
                  <p className="font-bold">완벽한 진실의 성공</p>
                  <p>진실 외침에 모든 주민이 신뢰하면 양 변화 없이 턴이 종료됩니다.</p>
                </div>

                <div className="rounded-xl bg-red-100 p-3">
                  <p className="font-bold">완벽한 진실의 실패</p>
                  <p>늑대 카드를 진실로 외쳤는데 모두 불신하면 양치기는 모든 양을 잃습니다.</p>
                </div>

                <div className="rounded-xl bg-yellow-100 p-3">
                  <p className="font-bold">완벽한 거짓의 성공</p>
                  <p>늑대 카드를 거짓으로 외쳤는데 모두 신뢰하면 양치기는 신뢰 양의 2배를 가져갑니다.</p>
                </div>

                <div className="rounded-xl bg-gray-100 p-3">
                  <p className="font-bold">완벽한 거짓의 실패</p>
                  <p>평화 카드를 거짓으로 외쳤는데 모두 불신하면 양치기는 양 1마리를 잃습니다.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {showHistory && (
          <div className="rounded-2xl bg-white text-green-950 p-4 mb-5 overflow-x-auto">
            <h2 className="text-xl font-bold mb-4">외침 기록표</h2>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="border border-green-900 p-2">순서</th>
                  <th className="border border-green-900 p-2">이름</th>
                  {Array.from({ length: shoutsPerTurn }, (_, i) => i + 1).map(
                    (round) => (
                      <th key={round} className="border border-green-900 p-2">
                        {round}차
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {orderedPlayers.map((name, index) => (
                  <tr key={name}>
                    <td className="border border-green-900 p-2 text-center">
                      {index + 1}
                    </td>

                    <td className="border border-green-900 p-2 font-bold">
                      {name}
                    </td>

                    {Array.from({ length: shoutsPerTurn }, (_, i) => i + 1).map(
                      (round) => (
                        <td
                          key={round}
                          className="border border-green-900 p-2 text-center"
                        >
                          {shoutHistory[name]?.[round]
                            ? shoutHistory[name][round] === "늑대"
                              ? "늑대가 왔다"
                              : "평화롭다"
                            : "-"}
                        </td>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="rounded-2xl bg-white/10 p-4 mb-5">
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="text-green-200">플레이어 순서</p>
              <p className="text-sm text-green-100">
                현재 라운드 {currentRound} / {totalRounds}
              </p>
            </div>

            <p className="text-sm text-green-100">
              외침 {roundInTurn} / {shoutsPerTurn}
            </p>
          </div>

          {phase === "betting" && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl bg-white text-green-950 p-3 text-center">
                <p className="text-sm">전체 신뢰</p>
                <p className="text-2xl font-bold">🐑 {totalTrust}</p>
              </div>

              <div className="rounded-xl bg-white/10 text-white p-3 text-center">
                <p className="text-sm">전체 불신</p>
                <p className="text-2xl font-bold">🐑 {totalDistrust}</p>
              </div>
            </div>
          )}

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
                    {index + 1}. {name}
                    {name === shepherd ? " 🧑‍🌾" : ""}
                  </span>

                  <span className="font-bold text-right text-sm">
                    {player.eliminated ? (
                      "탈락"
                    ) : (
                      <span>
                        🐑 {player.sheep}
                        {phase === "betting" && previewBets[name] && (
                          <span className="ml-2">
                            / {previewBets[name].choice} {previewBets[name].amount}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
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

                const change = resultChanges[player.name];

                return (
                  <div
                    key={player.name}
                    className="flex justify-between rounded-xl bg-white/60 px-4 py-3"
                  >
                    <span>
                      {player.eliminated ? "💀" : "🐑"} {player.name}
                    </span>
                    <span className="font-bold">
                      {player.sheep}마리
                      {change !== undefined && (
                        <span
                          className={
                            change > 0
                              ? "ml-2 text-blue-700"
                              : change < 0
                              ? "ml-2 text-red-700"
                              : "ml-2 text-gray-700"
                          }
                        >
                          {change > 0 ? `+${change}` : change}
                        </span>
                      )}
                    </span>
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
            <h2 className="text-2xl font-bold mb-4">
              당신은 <span className="text-blue-300">양치기</span>입니다.
            </h2>

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
            ) : bets[playerName] ? (
              <div className="rounded-2xl bg-white/10 p-5">
                <p className="text-green-200 mb-2">베팅 완료</p>
                <p className="text-2xl font-bold">
                  {bets[playerName].choice} / 양 {bets[playerName].amount}마리
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

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="rounded-2xl bg-white text-green-950 p-4 text-center">
                    <p className="font-bold mb-3">신뢰</p>

                    <button
                      onClick={() => {
                        if (trustAmount >= maxBet) return;
                        setDistrustAmount(0);
                        setTrustAmount(trustAmount + 1);
                      }}
                      className="w-full rounded-xl bg-green-950 text-white py-2 font-bold"
                    >
                      +
                    </button>

                    <div className="text-4xl font-bold my-4">{trustAmount}</div>

                    <button
                      onClick={() => setTrustAmount(Math.max(0, trustAmount - 1))}
                      className="w-full rounded-xl bg-green-950 text-white py-2 font-bold"
                    >
                      -
                    </button>
                  </div>

                  <div className="rounded-2xl bg-white/10 text-white p-4 text-center">
                    <p className="font-bold mb-3">불신</p>

                    <button
                      onClick={() => {
                        if (distrustAmount >= maxBet) return;
                        setTrustAmount(0);
                        setDistrustAmount(distrustAmount + 1);
                      }}
                      className="w-full rounded-xl bg-white text-green-950 py-2 font-bold"
                    >
                      +
                    </button>

                    <div className="text-4xl font-bold my-4">
                      {distrustAmount}
                    </div>

                    <button
                      onClick={() =>
                        setDistrustAmount(Math.max(0, distrustAmount - 1))
                      }
                      className="w-full rounded-xl bg-white text-green-950 py-2 font-bold"
                    >
                      -
                    </button>
                  </div>
                </div>

                <button
                  onClick={submitBet}
                  className="w-full rounded-2xl bg-yellow-300 text-green-950 py-4 text-lg font-bold"
                >
                  베팅 확정
                </button>
              </div>
            )}
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 bg-green-950/95 border-t border-white/20 p-3">
          <div className="mx-auto max-w-md rounded-xl bg-white/10 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-green-200">{playerName}</span>
              <span className="font-bold">🐑 {mySheep}마리</span>
            </div>

            <div className="flex justify-between mt-1">
              <span className="text-green-200">역할</span>
              <span className="font-bold">{isShepherd ? "양치기" : "주민"}</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

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

        <div className="space-y-4 mb-8">
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="font-bold mb-3">총 라운드 수</p>
            <div className="flex items-center justify-between">
              <button
                onClick={() => setTotalRounds(Math.max(1, totalRounds - 1))}
                className="rounded-xl bg-white text-green-950 px-5 py-2 font-bold"
              >
                -
              </button>
              <span className="text-3xl font-bold">{totalRounds}</span>
              <button
                onClick={() => setTotalRounds(totalRounds + 1)}
                className="rounded-xl bg-white text-green-950 px-5 py-2 font-bold"
              >
                +
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 p-4">
            <p className="font-bold mb-3">한 판당 외침 수</p>
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShoutsPerTurn(Math.max(1, shoutsPerTurn - 1))}
                className="rounded-xl bg-white text-green-950 px-5 py-2 font-bold"
              >
                -
              </button>
              <span className="text-3xl font-bold">{shoutsPerTurn}</span>
              <button
                onClick={() => setShoutsPerTurn(shoutsPerTurn + 1)}
                className="rounded-xl bg-white text-green-950 px-5 py-2 font-bold"
              >
                +
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 p-4">
            <p className="font-bold mb-3">시작 양 개수</p>
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStartingSheep(Math.max(1, startingSheep - 1))}
                className="rounded-xl bg-white text-green-950 px-5 py-2 font-bold"
              >
                -
              </button>
              <span className="text-3xl font-bold">{startingSheep}</span>
              <button
                onClick={() => setStartingSheep(startingSheep + 1)}
                className="rounded-xl bg-white text-green-950 px-5 py-2 font-bold"
              >
                +
              </button>
            </div>
          </div>
        </div>

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

        <p className="text-green-100 mb-2">현재 참가자: {players.length}명</p>

        <p className="text-green-100 mb-2">방장: {hostName || "아직 없음"}</p>

        <p className="text-green-100 mb-6">
          설정: 총 {totalRounds}라운드 / 외침 {shoutsPerTurn}번 / 시작 양{" "}
          {startingSheep}마리
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