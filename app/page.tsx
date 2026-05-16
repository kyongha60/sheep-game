"use client";

import { useEffect, useRef, useState } from "react";
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
  const [drawTimeLimit, setDrawTimeLimit] = useState(30);
  const [betTimeLimit, setBetTimeLimit] = useState(180);
  const [phaseEndsAt, setPhaseEndsAt] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeoutHandled, setTimeoutHandled] = useState(false);

  const [trustAmount, setTrustAmount] = useState(0);
  const [distrustAmount, setDistrustAmount] = useState(0);
  const [bets, setBets] = useState<Record<string, Bet>>({});

  const [isTruth, setIsTruth] = useState<boolean | null>(null);
  const [winner, setWinner] = useState("");
  const [specialEvent, setSpecialEvent] = useState("");
  const [resultChanges, setResultChanges] = useState<Record<string, number>>({});

  const [showHistory, setShowHistory] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [shoutHistory, setShoutHistory] = useState<Record<string, Record<string, string>>>({});
  const [roundShepherds, setRoundShepherds] = useState<Record<string, string>>({});

  const [specialRulesDisabled, setSpecialRulesDisabled] = useState(false);
  const [forcedDistrustAmount, setForcedDistrustAmount] = useState<number | null>(null);
  const [forcedDistrustShepherd, setForcedDistrustShepherd] = useState("");

  const soundsRef = useRef<Record<string, HTMLAudioElement> | null>(null);

  useEffect(() => {
    soundsRef.current = {
      click: new Audio("/sounds/click.mp3"),
      card: new Audio("/sounds/card.mp3"),
      bet: new Audio("/sounds/bet.mp3"),
      result: new Audio("/sounds/result.mp3"),
      sheep: new Audio("/sounds/sheep.mp3"),
    };

    Object.values(soundsRef.current).forEach((audio) => {
      audio.preload = "auto";
      audio.volume = 0.7;
      audio.load();
    });
  }, []);

  const playSound = (name: "click" | "card" | "bet" | "result" | "sheep") => {
    const audio = soundsRef.current?.[name];
    if (!audio) return;

    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

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
        setDrawTimeLimit(data.settings.drawTimeLimit ?? 30);
        setBetTimeLimit(data.settings.betTimeLimit ?? 180);
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
      setRoundShepherds(data.roundShepherds || {});
      setPhaseEndsAt(data.phaseEndsAt || null);
      setSpecialRulesDisabled(data.specialRulesDisabled || false);
      setForcedDistrustAmount(data.forcedDistrustAmount || null);
      setForcedDistrustShepherd(data.forcedDistrustShepherd || "");

      if (data.phase) {
        setPhase(data.phase);
        setTimeoutHandled(false);

        if (data.phase === "draw" || data.phase === "drawing" || data.phase === "shout") {
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

  useEffect(() => {
    if (!phaseEndsAt) {
      setTimeLeft(0);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    }, 300);

    return () => clearInterval(interval);
  }, [phaseEndsAt]);

  useEffect(() => {
    if (!roomCode) return;
    if (!phaseEndsAt) return;
    if (timeLeft > 0) return;
    if (timeoutHandled) return;
    if (phase !== "draw" && phase !== "betting") return;

    setTimeoutHandled(true);
    handleTimeout();
  }, [timeLeft, phase, phaseEndsAt, timeoutHandled, roomCode]);

  const resetToHome = () => {
    playSound("click");

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
    setRoundShepherds({});
    setSpecialRulesDisabled(false);
    setForcedDistrustAmount(null);
    setForcedDistrustShepherd("");
  };

  const createRoom = async () => {
    playSound("click");

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
      roundShepherds: {},
      specialRulesDisabled: false,
      forcedDistrustAmount: null,
      forcedDistrustShepherd: null,
      settings: {
        totalRounds,
        shoutsPerTurn,
        startingSheep,
        drawTimeLimit,
        betTimeLimit,
      },
    });

    setRoomCode(code);
    setScreen("name");
  };

  const joinRoom = async () => {
    playSound("click");

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
    playSound("click");

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
    playSound("click");

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
      phaseEndsAt: Date.now() + drawTimeLimit * 1000,
      shepherd: shuffledPlayers[0],
      playerOrder: shuffledPlayers,
      roundShepherds: {
        1: shuffledPlayers[0],
      },
      players: playerData,
      currentCard: null,
      shout: null,
      bets: null,
      isTruth: null,
      specialEvent: null,
      winner: null,
      resultChanges: null,
      shoutHistory: null,
      specialRulesDisabled: false,
      forcedDistrustAmount: null,
      forcedDistrustShepherd: null,
      settings: {
        totalRounds,
        shoutsPerTurn,
        startingSheep,
        drawTimeLimit,
        betTimeLimit,
      },
    });
  };

  const drawCard = async () => {
    if (playerName !== shepherd) return;

    playSound("card");

    await update(ref(database, `rooms/${roomCode}`), {
      phase: "drawing",
      currentCard: null,
      phaseEndsAt: null,
    });

    setTimeout(async () => {
      const card = Math.random() < 0.5 ? "평화" : "늑대";

      await update(ref(database, `rooms/${roomCode}`), {
        currentCard: card,
        phase: "shout",
        phaseEndsAt: null,
      });
    }, 1800);
  };

  const makeShout = async (selectedShout: "평화" | "늑대") => {
    playSound("click");

    if (playerName !== shepherd) return;

    await update(ref(database, `rooms/${roomCode}`), {
      shout: selectedShout,
      phase: "betting",
      bets: null,
      phaseEndsAt: Date.now() + betTimeLimit * 1000,
      [`shoutHistory/${shepherd}/${roundInTurn}`]: selectedShout,
    });

    setTrustAmount(0);
    setDistrustAmount(0);
  };

  const submitBet = async () => {
    if (!playerName || playerName === shepherd) return;
    if (playerScores[playerName]?.eliminated) return;

    const forcedDistrustActive =
      specialRulesDisabled &&
      forcedDistrustShepherd === shepherd &&
      playerName !== shepherd;

    const choice = forcedDistrustActive
      ? "불신"
      : trustAmount > 0
      ? "신뢰"
      : "불신";

    const amount = forcedDistrustActive
      ? Math.min(forcedDistrustAmount || 2, mySheep)
      : trustAmount > 0
      ? trustAmount
      : distrustAmount;

    if (amount <= 0) {
      alert("양을 최소 1마리 이상 걸어야 합니다.");
      return;
    }

    const safeAmount = Math.min(amount, mySheep, 5);

    playSound("bet");

    await set(ref(database, `rooms/${roomCode}/bets/${playerName}`), {
      name: playerName,
      choice,
      amount: safeAmount,
    });
  };

  const calculateResult = async () => {
    playSound("result");

    const roomSnapshot = await get(ref(database, `rooms/${roomCode}`));
    const room = roomSnapshot.val();
    if (!room) return;
    if (room.phase !== "betting") return;

    const card = room.currentCard;
    const roomShout = room.shout;
    const roomShepherd = room.shepherd;
    const roomPlayers = room.players || {};
    const roomBets = room.bets || {};

    const updatedPlayers: Record<string, Player> = JSON.parse(JSON.stringify(roomPlayers));

    const beforeSheep: Record<string, number> = {};
    Object.keys(roomPlayers).forEach((name) => {
      beforeSheep[name] = roomPlayers[name].sheep;
    });

    const activeResidents = Object.keys(roomPlayers).filter(
      (name) => name !== roomShepherd && !roomPlayers[name].eliminated
    );

    activeResidents.forEach((name) => {
      if (!roomBets[name]) {
        updatedPlayers[name].sheep -= 2;
      }
    });

    const truth = card === roomShout;

    const validBets = Object.values(roomBets).filter(
      (bet: any) => bet.choice === "신뢰" || bet.choice === "불신"
    );

    const totalVotedResidents = validBets.length;

    const trustCount = validBets.filter((bet: any) => bet.choice === "신뢰").length;
    const distrustCount = validBets.filter((bet: any) => bet.choice === "불신").length;

    let eventName = "";
    let skipBasic = false;
    let instantNextShepherd = false;

    if (
      truth &&
      trustCount === totalVotedResidents &&
      totalVotedResidents >= 1 &&
      !room.specialRulesDisabled
    ) {
      eventName = "완벽한 진실의 성공";
      skipBasic = true;
      instantNextShepherd = true;
    }

    if (
      card === "늑대" &&
      roomShout === "늑대" &&
      truth &&
      distrustCount === totalVotedResidents &&
      totalVotedResidents >= 1 &&
      !room.specialRulesDisabled
    ) {
      eventName = "완벽한 진실의 실패";
      skipBasic = true;
      updatedPlayers[roomShepherd].sheep = 0;
      updatedPlayers[roomShepherd].eliminated = true;
      instantNextShepherd = true;
    }

    if (
      card === "늑대" &&
      roomShout === "평화" &&
      !truth &&
      trustCount === totalVotedResidents &&
      totalVotedResidents >= 1 &&
      !room.specialRulesDisabled
    ) {
      eventName = "완벽한 거짓의 성공";
      skipBasic = true;

      validBets.forEach((bet: any) => {
        updatedPlayers[bet.name].sheep -= bet.amount * 2;
        updatedPlayers[roomShepherd].sheep += bet.amount * 2;
      });
    }

    if (
      card === "평화" &&
      roomShout === "늑대" &&
      !truth &&
      distrustCount === totalVotedResidents &&
      totalVotedResidents >= 1 &&
      !room.specialRulesDisabled
    ) {
      eventName = "완벽한 거짓의 실패";
      skipBasic = true;
      updatedPlayers[roomShepherd].sheep -= 1;
    }

    if (!skipBasic) {
      validBets.forEach((bet: any) => {
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
      phaseEndsAt: null,
      isTruth: truth,
      specialEvent: eventName,
      resultChanges,
      forceNextShepherd: instantNextShepherd,
      specialRulesDisabled:
        eventName === "완벽한 거짓의 실패"
          ? true
          : room.specialRulesDisabled || false,
      forcedDistrustAmount:
        eventName === "완벽한 거짓의 실패"
          ? 2
          : room.forcedDistrustAmount || null,
      forcedDistrustShepherd:
        eventName === "완벽한 거짓의 실패"
          ? roomShepherd
          : room.forcedDistrustShepherd || null,
    });

    setPlayerScores(updatedPlayers);

    if (updatedPlayers[playerName]) {
      setMySheep(updatedPlayers[playerName].sheep);
    }
  };

  const handleTimeout = async () => {
    const roomSnapshot = await get(ref(database, `rooms/${roomCode}`));
    const room = roomSnapshot.val();
    if (!room) return;
    if (room.phase !== "draw" && room.phase !== "betting") return;
    if (room.phaseEndsAt && room.phaseEndsAt > Date.now()) return;

    const roomPhase = room.phase;
    const roomShepherd = room.shepherd;
    const roomPlayers = room.players || {};
    const roomBets = room.bets || {};

    const updatedPlayers: Record<string, Player> = JSON.parse(JSON.stringify(roomPlayers));

    const beforeSheep: Record<string, number> = {};
    Object.keys(roomPlayers).forEach((name) => {
      beforeSheep[name] = roomPlayers[name].sheep;
    });

    if (roomPhase === "draw") {
      if (updatedPlayers[roomShepherd]) {
        updatedPlayers[roomShepherd].sheep -= 2;
      }
    }

    if (roomPhase === "betting") {
      Object.keys(roomPlayers).forEach((name) => {
        if (name === roomShepherd) return;
        if (roomPlayers[name].eliminated) return;

        if (!roomBets[name]) {
          updatedPlayers[name].sheep -= 2;
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
      phaseEndsAt: null,
      isTruth: null,
      specialEvent:
        roomPhase === "draw"
          ? "시간 초과: 양치기 -2"
          : "시간 초과: 미베팅 주민 -2",
      resultChanges,
      forceNextShepherd: false,
    });
  };

  const nextRound = async () => {
    if (playerName !== shepherd) return;

    const roomSnapshot = await get(ref(database, `rooms/${roomCode}`));
    const room = roomSnapshot.val();
    const forceNextShepherd = room?.forceNextShepherd || false;

    const order = playerOrder.length > 0 ? playerOrder : players;
    const alivePlayers = order.filter((p) => !playerScores[p]?.eliminated);

    if (alivePlayers.length <= 1) {
      await update(ref(database, `rooms/${roomCode}`), {
        status: "finished",
        phase: "finished",
        phaseEndsAt: null,
        winner: alivePlayers[0] || shepherd,
      });
      return;
    }

    let nextShepherd = shepherd;
    let nextRoundInTurn = forceNextShepherd ? shoutsPerTurn + 1 : roundInTurn + 1;
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
          phaseEndsAt: null,
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

    const shepherdChanged = nextShepherd !== shepherd;

    await update(ref(database, `rooms/${roomCode}`), {
      shepherd: nextShepherd,
      roundInTurn: nextRoundInTurn,
      currentRound: nextCurrentRound,
      [`roundShepherds/${nextCurrentRound}`]: nextShepherd,
      currentCard: null,
      shout: null,
      bets: null,
      phase: "draw",
      phaseEndsAt: Date.now() + drawTimeLimit * 1000,
      isTruth: null,
      specialEvent: null,
      resultChanges: null,
      forceNextShepherd: false,
      specialRulesDisabled: shepherdChanged ? false : specialRulesDisabled,
      forcedDistrustAmount: shepherdChanged ? null : forcedDistrustAmount,
      forcedDistrustShepherd: shepherdChanged ? null : forcedDistrustShepherd,
    });

    setTrustAmount(0);
    setDistrustAmount(0);
  };

  const inputClass =
    "w-full rounded-2xl bg-white border border-white/30 px-4 py-4 text-black placeholder-gray-500 text-lg mb-4";

  const orderedPlayers = playerOrder.length > 0 ? playerOrder : players;

  const getCardStyle = (card: string) => {
    if (card === "늑대") {
      return { emoji: "🐺", text: "늑대", color: "text-red-600" };
    }

    return { emoji: "🐑", text: "평화", color: "text-blue-600" };
  };

  if (screen === "game") {
    const isShepherd = playerName === shepherd;
    const isEliminated = !!playerScores[playerName]?.eliminated;
    const maxBet = Math.max(1, Math.min(5, mySheep));

    const previewBets: Record<string, Bet> = { ...bets };

    if (!isShepherd && !bets[playerName] && !isEliminated) {
      if (trustAmount > 0) {
        previewBets[playerName] = { name: playerName, choice: "신뢰", amount: trustAmount };
      }

      if (distrustAmount > 0) {
        previewBets[playerName] = { name: playerName, choice: "불신", amount: distrustAmount };
      }
    }

    const totalTrust = Object.values(previewBets)
      .filter((bet: any) => bet.choice === "신뢰")
      .reduce((sum: number, bet: any) => sum + bet.amount, 0);

    const totalDistrust = Object.values(previewBets)
      .filter((bet: any) => bet.choice === "불신")
      .reduce((sum: number, bet: any) => sum + bet.amount, 0);

    const activeResidents = orderedPlayers.filter(
      (name) => name !== shepherd && !playerScores[name]?.eliminated
    );

    const allResidentsBetted = activeResidents.every((name) => bets[name]);

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
                <div key={player.name} className="flex justify-between rounded-2xl bg-white/10 px-4 py-4">
                  <span>{player.eliminated ? "💀" : "🐑"} {player.name}</span>
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
            onClick={() => {
              playSound("click");
              setShowRules(!showRules);
            }}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold"
          >
            {showRules ? "룰 닫기" : "룰 설명"}
          </button>

          <button
            onClick={() => {
              playSound("click");
              setShowHistory(!showHistory);
            }}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold"
          >
            {showHistory ? "기록 닫기" : "기록 보기"}
          </button>
        </div>

        {showHistory && (
          <div className="rounded-2xl bg-white text-green-950 p-4 mb-5 overflow-x-auto">
            <h2 className="text-xl font-bold mb-4">외침 기록표</h2>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="border border-green-900 p-2">라운드</th>
                  <th className="border border-green-900 p-2">양치기</th>
                  {Array.from({ length: shoutsPerTurn }, (_, i) => i + 1).map((round) => (
                    <th key={round} className="border border-green-900 p-2">
                      {round}차
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {Array.from({ length: totalRounds }, (_, i) => i + 1).map((roundNumber) => {
                  const playerNameForRound = roundShepherds[String(roundNumber)];

                  return (
                    <tr key={roundNumber}>
                      <td className="border border-green-900 p-2 text-center">{roundNumber}</td>
                      <td className="border border-green-900 p-2 font-bold">{playerNameForRound || "-"}</td>

                      {Array.from({ length: shoutsPerTurn }, (_, i) => i + 1).map((shoutNumber) => (
                        <td key={shoutNumber} className="border border-green-900 p-2 text-center">
                          {playerNameForRound && shoutHistory[playerNameForRound]?.[shoutNumber]
                            ? shoutHistory[playerNameForRound][shoutNumber] === "늑대"
                              ? "늑대가 왔다"
                              : "평화롭다"
                            : "-"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {(phase === "draw" || phase === "betting") && (
          <div className="rounded-2xl bg-red-500 text-white p-3 mb-4 text-center font-bold">
            남은 시간: {Math.floor(timeLeft / 60)}:
            {(timeLeft % 60).toString().padStart(2, "0")}
          </div>
        )}

        <div className="rounded-2xl bg-white/10 p-4 mb-5">
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="text-green-200">플레이어 순서</p>
              <p className="text-sm text-green-100">현재 라운드 {currentRound} / {totalRounds}</p>
            </div>
            <p className="text-sm text-green-100">외침 {roundInTurn} / {shoutsPerTurn}</p>
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
                    name === shepherd ? "bg-yellow-300 text-green-950" : "bg-white/10 text-white"
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
                      <div className="flex flex-col items-end">
                        <span>🐑 {player.sheep}</span>

                        {phase === "betting" && previewBets[name] && (
                          <span className="text-xs text-green-200">
                            {previewBets[name].choice} {previewBets[name].amount}
                          </span>
                        )}

                        {phase === "betting" && bets[name] && (
                          <span className="text-xs text-yellow-300 font-bold">베팅 확정</span>
                        )}
                      </div>
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
              {isTruth === null ? "시간 초과 처리" : isTruth ? "진실이었습니다" : "거짓이었습니다"}
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
                  <div key={player.name} className="flex justify-between rounded-xl bg-white/60 px-4 py-3">
                    <span>{player.eliminated ? "💀" : "🐑"} {player.name}</span>
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

            {playerName === shepherd && (
              <button
                onClick={nextRound}
                className="w-full rounded-2xl bg-green-950 text-white py-4 text-lg font-bold mt-6"
              >
                다음 라운드
              </button>
            )}
          </div>
        )}

        {isEliminated ? (
          <div className="rounded-2xl bg-white/10 p-5 text-center">
            <h2 className="text-2xl font-bold mb-3">관전 중</h2>
            <p className="text-green-100">
              양이 0마리가 되어 탈락했습니다. 게임 진행은 계속 볼 수 있습니다.
            </p>
          </div>
        ) : isShepherd ? (
          <div>
            <h2 className="text-2xl font-bold mb-4">
              당신은 <span className="text-blue-300">양치기</span>입니다.
            </h2>

            {phase === "drawing" ? (
              <div className="rounded-2xl bg-white text-green-950 p-8 text-center animate-pulse">
                <p className="text-lg mb-4">카드를 뽑는 중...</p>
                <div className="text-6xl">🎴</div>
              </div>
            ) : !currentCard ? (
              <button
                onClick={drawCard}
                className="w-full rounded-2xl bg-white text-green-950 py-4 text-lg font-bold"
              >
                카드 뽑기
              </button>
            ) : (
              <div className="rounded-2xl bg-white text-green-950 p-6 text-center">
                <p className="text-lg mb-2">뽑은 카드</p>
                <div className="text-7xl mb-3">{getCardStyle(currentCard).emoji}</div>
                <div className={`text-5xl font-bold ${getCardStyle(currentCard).color}`}>
                  {getCardStyle(currentCard).text}
                </div>

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

            {phase === "betting" && allResidentsBetted && (
              <button
                onClick={calculateResult}
                className="w-full rounded-2xl bg-yellow-300 text-green-950 py-4 text-lg font-bold mt-6"
              >
                결과 보기
              </button>
            )}

            {phase === "betting" && !allResidentsBetted && (
              <div className="rounded-2xl bg-white/10 p-4 mt-6 text-center">
                <p className="text-green-100">주민들의 베팅을 기다리는 중입니다.</p>
                <p className="text-sm text-green-200 mt-2">
                  {Object.keys(bets).length} / {activeResidents.length}명 완료
                </p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold mb-4">당신은 주민입니다.</h2>

            {phase === "drawing" ? (
              <div className="rounded-2xl bg-white/10 p-6 text-center animate-pulse">
                <p className="text-green-100 mb-4">양치기가 카드를 뽑는 중...</p>
                <div className="text-6xl">🎴</div>
              </div>
            ) : !shout ? (
              <p className="text-green-100">양치기의 외침을 기다리세요.</p>
            ) : bets[playerName] ? (
              <div className="rounded-2xl bg-white/10 p-5">
                <p className="text-green-200 mb-2">베팅 완료</p>
                <p className="text-2xl font-bold">
                  {bets[playerName].choice} / 양 {bets[playerName].amount}마리
                </p>

                {allResidentsBetted && (
                  <button
                    onClick={calculateResult}
                    className="w-full rounded-2xl bg-yellow-300 text-green-950 py-4 text-lg font-bold mt-6"
                  >
                    결과 보기
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="rounded-2xl bg-white/10 p-5 mb-6">
                  <p className="text-green-200 mb-2">양치기의 외침</p>
                  <h2 className="text-4xl font-bold">
                    {shout === "늑대" ? "늑대가 왔다!" : "평화롭다!"}
                  </h2>
                </div>

                {specialRulesDisabled && forcedDistrustShepherd === shepherd && (
                  <div className="rounded-2xl bg-red-500 text-white p-4 mb-4 text-center font-bold">
                    특수룰 효과: 불신 베팅 2마리 고정
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div
                    className={`rounded-2xl p-4 text-center ${
                      specialRulesDisabled && forcedDistrustShepherd === shepherd
                        ? "bg-gray-400 text-gray-700"
                        : "bg-white text-green-950"
                    }`}
                  >
                    <p className="font-bold mb-3">신뢰</p>

                    <button
                      onClick={() => {
                        playSound("sheep");
                        if (specialRulesDisabled && forcedDistrustShepherd === shepherd) return;
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
                      onClick={() => {
                        playSound("sheep");
                        if (specialRulesDisabled && forcedDistrustShepherd === shepherd) return;
                        setTrustAmount(Math.max(0, trustAmount - 1));
                      }}
                      className="w-full rounded-xl bg-green-950 text-white py-2 font-bold"
                    >
                      -
                    </button>
                  </div>

                  <div className="rounded-2xl bg-white/10 text-white p-4 text-center">
                    <p className="font-bold mb-3">불신</p>

                    <button
                      onClick={() => {
                        playSound("sheep");
                        if (distrustAmount >= maxBet) return;
                        setTrustAmount(0);
                        setDistrustAmount(distrustAmount + 1);
                      }}
                      className="w-full rounded-xl bg-white text-green-950 py-2 font-bold"
                    >
                      +
                    </button>

                    <div className="text-4xl font-bold my-4">
                      {specialRulesDisabled && forcedDistrustShepherd === shepherd
                        ? Math.min(forcedDistrustAmount || 2, mySheep)
                        : distrustAmount}
                    </div>

                    <button
                      onClick={() => {
                        playSound("sheep");
                        if (specialRulesDisabled && forcedDistrustShepherd === shepherd) return;
                        setDistrustAmount(Math.max(0, distrustAmount - 1));
                      }}
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
              <span className="font-bold">
                {isEliminated ? "관전" : isShepherd ? "양치기" : "주민"}
              </span>
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
          onClick={() => {
            playSound("click");
            setScreen("home");
          }}
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
                onClick={() => {
                  playSound("click");
                  setTotalRounds(Math.max(1, totalRounds - 1));
                }}
                className="rounded-xl bg-white text-green-950 px-5 py-2 font-bold"
              >
                -
              </button>
              <span className="text-3xl font-bold">{totalRounds}</span>
              <button
                onClick={() => {
                  playSound("click");
                  setTotalRounds(totalRounds + 1);
                }}
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
                onClick={() => {
                  playSound("click");
                  setShoutsPerTurn(Math.max(1, shoutsPerTurn - 1));
                }}
                className="rounded-xl bg-white text-green-950 px-5 py-2 font-bold"
              >
                -
              </button>
              <span className="text-3xl font-bold">{shoutsPerTurn}</span>
              <button
                onClick={() => {
                  playSound("click");
                  setShoutsPerTurn(shoutsPerTurn + 1);
                }}
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
                onClick={() => {
                  playSound("click");
                  setStartingSheep(Math.max(1, startingSheep - 1));
                }}
                className="rounded-xl bg-white text-green-950 px-5 py-2 font-bold"
              >
                -
              </button>
              <span className="text-3xl font-bold">{startingSheep}</span>
              <button
                onClick={() => {
                  playSound("click");
                  setStartingSheep(startingSheep + 1);
                }}
                className="rounded-xl bg-white text-green-950 px-5 py-2 font-bold"
              >
                +
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 p-4">
            <p className="font-bold mb-3">카드 뽑기 제한시간(초)</p>
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  playSound("click");
                  setDrawTimeLimit(Math.max(5, drawTimeLimit - 5));
                }}
                className="rounded-xl bg-white text-green-950 px-5 py-2 font-bold"
              >
                -
              </button>
              <span className="text-3xl font-bold">{drawTimeLimit}</span>
              <button
                onClick={() => {
                  playSound("click");
                  setDrawTimeLimit(drawTimeLimit + 5);
                }}
                className="rounded-xl bg-white text-green-950 px-5 py-2 font-bold"
              >
                +
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 p-4">
            <p className="font-bold mb-3">베팅 제한시간(초)</p>
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  playSound("click");
                  setBetTimeLimit(Math.max(10, betTimeLimit - 10));
                }}
                className="rounded-xl bg-white text-green-950 px-5 py-2 font-bold"
              >
                -
              </button>
              <span className="text-3xl font-bold">{betTimeLimit}</span>
              <button
                onClick={() => {
                  playSound("click");
                  setBetTimeLimit(betTimeLimit + 10);
                }}
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
          onClick={() => {
            playSound("click");
            setScreen("home");
          }}
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
          onClick={() => {
            playSound("click");
            setScreen("home");
          }}
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
            <div key={player} className="rounded-2xl bg-white/10 px-4 py-4 text-lg">
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
    <main className="min-h-screen bg-green-950 text-white flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm text-center">
        <div className="text-6xl mb-6">🐑</div>

        <h1 className="text-4xl font-bold mb-3">양치기 게임</h1>

        <p className="text-green-100 mb-6 leading-relaxed">
          양치기 소년의 외침을 믿을지, 의심할지 선택하세요.
        </p>

        <div className="flex justify-center mb-6">
          <button
            onClick={() => {
              playSound("click");
              setShowRules(!showRules);
            }}
            className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold"
          >
            {showRules ? "룰 닫기" : "룰 설명"}
          </button>
        </div>

        {showRules && (
          <div className="rounded-2xl bg-white text-green-950 p-4 mb-6 text-left text-sm leading-relaxed">
            <h2 className="text-xl font-bold mb-4 text-center">룰 설명</h2>

            <div className="mb-4">
              <h3 className="font-bold text-lg mb-2">기본 진행</h3>
              <p className="mb-2">플레이어들은 순서대로 양치기가 되며 카드를 뽑고 외침을 합니다.</p>
              <p>주민들은 외침을 믿을지(신뢰), 의심할지(불신) 양을 걸고 베팅합니다.</p>
            </div>

            <div className="mb-4">
              <h3 className="font-bold text-lg mb-2">제한시간 / 기권</h3>
              <p>
                정해진 시간 안에 베팅하지 못한 주민은 양 2마리를 잃습니다.
                단, 기권자는 특수 룰의 “모든 주민” 판정에서 제외됩니다.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-2">특수 룰</h3>

              <div className="space-y-2">
                <div className="rounded-xl bg-green-100 p-3">
                  <p className="font-bold">완벽한 진실의 성공</p>
                  <p>진실 외침에 모든 베팅 주민이 신뢰하면 양 변화 없이 즉시 다음 양치기로 넘어갑니다.</p>
                </div>

                <div className="rounded-xl bg-red-100 p-3">
                  <p className="font-bold">완벽한 진실의 실패</p>
                  <p>늑대를 진실로 외쳤는데 모든 베팅 주민이 불신하면 양치기는 모든 양을 잃습니다.</p>
                </div>

                <div className="rounded-xl bg-yellow-100 p-3">
                  <p className="font-bold">완벽한 거짓의 성공</p>
                  <p>늑대를 뽑고 평화라고 거짓말했는데 모두 신뢰하면, 양치기는 신뢰에 걸린 양의 2배를 가져갑니다.</p>
                </div>

                <div className="rounded-xl bg-gray-100 p-3">
                  <p className="font-bold">완벽한 거짓의 실패</p>
                  <p>평화를 뽑고 늑대라고 거짓말했는데 모두 불신하면, 양치기는 양 1마리를 잃고 불신 베팅이 2로 고정됩니다.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <button
            onClick={() => {
              playSound("click");
              setScreen("create");
            }}
            className="w-full rounded-2xl bg-white text-green-950 py-4 text-lg font-bold"
          >
            방 만들기
          </button>

          <button
            onClick={() => {
              playSound("click");
              setScreen("join");
            }}
            className="w-full rounded-2xl border border-white/40 py-4 text-lg font-bold"
          >
            방 참가하기
          </button>
        </div>
      </div>
    </main>
  );
}