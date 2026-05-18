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

type SoundName = "click" | "card" | "bet" | "result" | "sheep";

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

  const [totalRounds, setTotalRounds] = useState(0);
  const [shoutsPerTurn, setShoutsPerTurn] = useState(1);
  const [startingSheep, setStartingSheep] = useState(0);
  const [shoutTimeLimit, setShoutTimeLimit] = useState(15);
  const [betTimeLimit, setBetTimeLimit] = useState(30);
  const [blindTimeLimit, setBlindTimeLimit] = useState(10);
  const [phaseEndsAt, setPhaseEndsAt] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeoutHandled, setTimeoutHandled] = useState(false);

  const [trustAmount, setTrustAmount] = useState(0);
  const [distrustAmount, setDistrustAmount] = useState(0);
  const [bets, setBets] = useState<Record<string, Bet>>({});
  const [liveBets, setLiveBets] = useState<Record<string, Bet>>({});

  const [isTruth, setIsTruth] = useState<boolean | null>(null);
  const [winners, setWinners] = useState<string[]>([]);
  const [gameEndReason, setGameEndReason] = useState("");
  const [specialEvent, setSpecialEvent] = useState("");
  const [resultChanges, setResultChanges] = useState<Record<string, number>>(
    {}
  );

  const [showHistory, setShowHistory] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [shoutHistory, setShoutHistory] = useState<
    Record<string, Record<string, string>>
  >({});
  const [roundShepherds, setRoundShepherds] = useState<
    Record<string, string>
  >({});

  const [specialRulesDisabled, setSpecialRulesDisabled] = useState(false);
  const [forcedDistrustAmount, setForcedDistrustAmount] = useState<
    number | null
  >(null);
  const [forcedDistrustShepherd, setForcedDistrustShepherd] = useState("");

  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isCalculating, setIsCalculating] = useState(false);

  const soundsRef = useRef<Record<SoundName, HTMLAudioElement> | null>(null);

  useEffect(() => {
    soundsRef.current = {
      click: new Audio("/sounds/click.mp3"),
      card: new Audio("/sounds/card.mp3"),
      bet: new Audio("/sounds/bet.mp3"),
      result: new Audio("/sounds/result.mp3"),
      sheep: new Audio("/sounds/sheep.mp3"),
    };

    Object.values(soundsRef.current).forEach((audio: HTMLAudioElement) => {
      audio.preload = "auto";
      audio.volume = volume;
      audio.load();
    });
  }, []);

  const playSound = (name: SoundName) => {
    if (muted) return;

    const audio = soundsRef.current?.[name];
    if (!audio) return;

    audio.currentTime = 0;
    audio.volume = volume;
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
        setTotalRounds(data.settings.totalRounds ?? 0);
        setShoutsPerTurn(data.settings.shoutsPerTurn ?? 1);
        setStartingSheep(data.settings.startingSheep ?? 0);
        setShoutTimeLimit(data.settings.shoutTimeLimit ?? 15);
        setBetTimeLimit(data.settings.betTimeLimit ?? 30);
        setBlindTimeLimit(data.settings.blindTimeLimit ?? 10);
      }

      setPlayerOrder(data.playerOrder || []);
      setHostName(data.hostName || "");
      setShepherd(data.shepherd || "");
      setCurrentCard(data.currentCard || "");
      setShout(data.shout || "");
      setCurrentRound(data.currentRound || 1);
      setRoundInTurn(data.roundInTurn || 1);
      setSpecialEvent(data.specialEvent || "");
      setBets(data.bets || {});
      setLiveBets(data.liveBets || {});
      setResultChanges(data.resultChanges || {});
      setShoutHistory(data.shoutHistory || {});
      setRoundShepherds(data.roundShepherds || {});
      setPhaseEndsAt(data.phaseEndsAt || null);
      setSpecialRulesDisabled(data.specialRulesDisabled || false);
      setForcedDistrustAmount(data.forcedDistrustAmount || null);
      setForcedDistrustShepherd(data.forcedDistrustShepherd || "");
      setWinners(data.winners || []);
      setGameEndReason(data.gameEndReason || "");

      if (data.phase) {
        setPhase(data.phase);
        setTimeoutHandled(false);

        if (
          data.phase === "draw" ||
          data.phase === "drawing" ||
          data.phase === "shout"
        ) {
          setTrustAmount(0);
          setDistrustAmount(0);
        }
      } else {
        setPhase("");
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
  }, [roomCode, playerName, startingSheep]);

  useEffect(() => {
    if (!phaseEndsAt) {
      setTimeLeft(0);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((phaseEndsAt - Date.now()) / 1000)
      );
      setTimeLeft(remaining);
    }, 300);

    return () => clearInterval(interval);
  }, [phaseEndsAt]);

  useEffect(() => {
    if (!roomCode) return;
    if (!phaseEndsAt) return;
    if (timeLeft > 0) return;
    if (timeoutHandled) return;
    if (phase !== "shout" && phase !== "betting") return;

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
    setBlindTimeLimit(10);
    setTrustAmount(0);
    setDistrustAmount(0);
    setBets({});
    setLiveBets({});
    setIsTruth(null);
    setWinners([]);
    setGameEndReason("");
    setSpecialEvent("");
    setResultChanges({});
    setShowHistory(false);
    setShowRules(false);
    setShowSettings(false);
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
      phaseEndsAt: null,
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
        shoutTimeLimit,
        betTimeLimit,
        blindTimeLimit,
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
      // 같은 방 코드와 같은 이름으로 다시 들어오면 진행 중인 게임을 재개합니다.
      setPlayerName(name);
      setScreen(room.status === "playing" || room.status === "finished" ? "game" : "lobby");
      return;
    }

    const roomStartingSheep = room.settings?.startingSheep ?? startingSheep;
    const isFirstPlayer =
      !room.players || Object.keys(room.players).length === 0;

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
    const actualTotalRounds = totalRounds > 0 ? totalRounds : shuffledPlayers.length * 3;
    const actualStartingSheep = startingSheep > 0 ? startingSheep : shuffledPlayers.length * 2;
    const playerData: Record<string, Player> = {};

    shuffledPlayers.forEach((player) => {
      playerData[player] = {
        name: player,
        sheep: actualStartingSheep,
        eliminated: false,
      };
    });

    await update(ref(database, `rooms/${roomCode}`), {
      status: "playing",
      currentRound: 1,
      currentTurn: 0,
      roundInTurn: 1,
      phase: "draw",
      phaseEndsAt: null,
      shepherd: shuffledPlayers[0],
      playerOrder: shuffledPlayers,
      roundShepherds: {
        1: shuffledPlayers[0],
      },
      players: playerData,
      currentCard: null,
      shout: null,
      bets: null,
      liveBets: null,
      isTruth: null,
      specialEvent: null,
      winners: null,
      gameEndReason: null,
      resultChanges: null,
      shoutHistory: null,
      specialRulesDisabled: false,
      forcedDistrustAmount: null,
      forcedDistrustShepherd: null,
      settings: {
        totalRounds: actualTotalRounds,
        shoutsPerTurn,
        startingSheep: actualStartingSheep,
        shoutTimeLimit,
        betTimeLimit,
        blindTimeLimit,
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
        phaseEndsAt:
          shoutTimeLimit > 0 ? Date.now() + shoutTimeLimit * 1000 : null,
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
      liveBets: null,
      phaseEndsAt:
        betTimeLimit > 0 ? Date.now() + betTimeLimit * 1000 : null,
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

    const safeAmount = Math.min(amount, mySheep, players.length);

    playSound("bet");

    await set(ref(database, `rooms/${roomCode}/bets/${playerName}`), {
      name: playerName,
      choice,
      amount: safeAmount,
    });

    await set(ref(database, `rooms/${roomCode}/liveBets/${playerName}`), null);
  };

  const resolveBettingResult = async (timeoutMessage?: string) => {
    const roomSnapshot = await get(ref(database, `rooms/${roomCode}`));
    const room = roomSnapshot.val();
    if (!room) return;
    if (room.phase !== "betting") return;

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

    const trustCount = validBets.filter(
      (bet: any) => bet.choice === "신뢰"
    ).length;

    const distrustCount = validBets.filter(
      (bet: any) => bet.choice === "불신"
    ).length;

    const T = trustCount;
    const L = distrustCount;

    const allTrust =
      trustCount === totalVotedResidents && totalVotedResidents >= 1;

    const allDistrust =
      distrustCount === totalVotedResidents && totalVotedResidents >= 1;

    const wolfTruthAllDistrust = card === "늑대" && truth && allDistrust;
    const wolfLieAllTrust = card === "늑대" && !truth && allTrust;
    const wolfLieAllDistrust = card === "늑대" && !truth && allDistrust;
    const sheepTruthAllDistrust = card === "평화" && truth && allDistrust;

    let eventName = "";

    // 주민 점수 계산
    // 기본: 맞추면 +베팅, 틀리면 -베팅
    // 특수: 늑대-진실-만장불신 / 늑대-거짓-만장신뢰는 주민이 베팅의 2배를 잃음
    validBets.forEach((bet: any) => {
      const name = bet.name;
      const amount = bet.amount;
      const playerTrusted = bet.choice === "신뢰";

      const correct =
        (truth && playerTrusted) || (!truth && !playerTrusted);

      if (wolfTruthAllDistrust || wolfLieAllTrust) {
        updatedPlayers[name].sheep -= amount * 2;
      } else if (correct) {
        updatedPlayers[name].sheep += amount;
      } else {
        updatedPlayers[name].sheep -= amount;
      }
    });

    // 양치기 점수 계산
    // 기본: 진실 = T-L, 거짓 = 2(T-L)
    if (wolfLieAllDistrust) {
      updatedPlayers[roomShepherd].sheep = 0;
      updatedPlayers[roomShepherd].eliminated = true;
      eventName = "늑대-거짓-만장불신: 양치기 몰수패";
    } else if (sheepTruthAllDistrust) {
      updatedPlayers[roomShepherd].sheep += -2 * (T - L);
      eventName = "평화-진실-만장불신: 양치기 -2배 정산";
    } else {
      if (truth) {
        updatedPlayers[roomShepherd].sheep += T - L;
      } else {
        updatedPlayers[roomShepherd].sheep += 2 * (T - L);
      }

      if (wolfTruthAllDistrust) {
        eventName = "늑대-진실-만장불신: 주민 2배 손실";
      }

      if (wolfLieAllTrust) {
        eventName = "늑대-거짓-만장신뢰: 주민 2배 손실";
      }
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
      specialEvent: eventName || timeoutMessage || "",
      resultChanges,
      forceNextShepherd: false,
      specialRulesDisabled: false,
      forcedDistrustAmount: null,
      forcedDistrustShepherd: null,
    });

    setPlayerScores(updatedPlayers);

    if (updatedPlayers[playerName]) {
      setMySheep(updatedPlayers[playerName].sheep);
    }
  };

  const calculateResult = async () => {
    if (isCalculating) return;
    if (playerName !== shepherd) return;

    setIsCalculating(true);

    try {
      playSound("result");
      await resolveBettingResult();
    } finally {
      setIsCalculating(false);
    }
  };

  const handleTimeout = async () => {
    const roomSnapshot = await get(ref(database, `rooms/${roomCode}`));
    const room = roomSnapshot.val();
    if (!room) return;
    if (room.phase !== "shout" && room.phase !== "betting") return;
    if (room.phaseEndsAt && room.phaseEndsAt > Date.now()) return;

    if (room.phase === "betting") {
      await resolveBettingResult("시간 초과: 미베팅 주민 -2");
      return;
    }

    const roomShepherd = room.shepherd;
    const roomPlayers = room.players || {};

    const updatedPlayers: Record<string, Player> = JSON.parse(
      JSON.stringify(roomPlayers)
    );

    const beforeSheep: Record<string, number> = {};
    Object.keys(roomPlayers).forEach((name) => {
      beforeSheep[name] = roomPlayers[name].sheep;
    });

    if (updatedPlayers[roomShepherd]) {
      updatedPlayers[roomShepherd].sheep -= 2;
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
      specialEvent: "시간 초과: 양치기 외침 실패 -2",
      resultChanges,
      forceNextShepherd: false,
    });
  };

  const finishByScores = async (reason: string) => {
    const finalPlayers = Object.values(playerScores) as Player[];
    const maxSheep = Math.max(...finalPlayers.map((player) => player.sheep));

    const finalWinners = finalPlayers
      .filter((player) => player.sheep === maxSheep)
      .map((player) => player.name);

    await update(ref(database, `rooms/${roomCode}`), {
      status: "finished",
      phase: "finished",
      phaseEndsAt: null,
      winners: finalWinners,
      gameEndReason: reason,
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
        winners: alivePlayers.length === 1 ? [alivePlayers[0]] : [],
        gameEndReason: "최후의 생존자",
      });
      return;
    }

    let nextShepherd = shepherd;
    let nextRoundInTurn = forceNextShepherd
      ? shoutsPerTurn + 1
      : roundInTurn + 1;
    let nextCurrentRound = currentRound;

    if (nextRoundInTurn > shoutsPerTurn) {
      if (currentRound >= totalRounds) {
        await finishByScores("총 라운드 종료");
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
      liveBets: null,
      phase: "draw",
      phaseEndsAt: null,
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

  const leaveCurrentGame = async () => {
    if (!roomCode || !playerName) return;

    const roomSnapshot = await get(ref(database, `rooms/${roomCode}`));
    const room = roomSnapshot.val();
    if (!room || !room.players?.[playerName]) {
      resetToHome();
      return;
    }

    await update(ref(database, `rooms/${roomCode}`), {
      [`players/${playerName}/sheep`]: 0,
      [`players/${playerName}/eliminated`]: true,
      [`players/${playerName}/left`]: true,
      [`bets/${playerName}`]: null,
      [`liveBets/${playerName}`]: null,
    });

    resetToHome();
  };

  const inputClass =
    "w-full rounded-2xl bg-white border border-white/30 px-4 py-4 text-black placeholder-gray-500 text-lg mb-4";

  const orderedPlayers = playerOrder.length > 0 ? playerOrder : players;

  const getCardStyle = (card: string) => {
    if (card === "늑대") {
      return { emoji: "🐺", text: "늑대", color: "text-red-500" };
    }

    return { emoji: "🐑", text: "평화", color: "text-blue-400" };
  };

  const getSpecialEventDescription = (eventName: string) => {
    if (eventName === "늑대-진실-만장불신: 주민 2배 손실") {
      return "실제 카드는 늑대였고 양치기도 늑대를 외쳤지만, 모든 주민이 불신했습니다. 주민들은 각자 건 양의 2배를 잃습니다.";
    }

    if (eventName === "늑대-거짓-만장신뢰: 주민 2배 손실") {
      return "실제 카드는 늑대였고 양치기는 평화라고 거짓말했으며, 모든 주민이 신뢰했습니다. 주민들은 각자 건 양의 2배를 잃습니다.";
    }

    if (eventName === "늑대-거짓-만장불신: 양치기 몰수패") {
      return "실제 카드는 늑대였고 양치기는 평화라고 거짓말했지만, 모든 주민이 불신했습니다. 양치기는 모든 양을 잃고 탈락합니다.";
    }

    if (eventName === "평화-진실-만장불신: 양치기 -2배 정산") {
      return "실제 카드는 평화였고 양치기도 평화를 외쳤지만, 모든 주민이 불신했습니다. 양치기는 -2 × (신뢰 인원 - 불신 인원)으로 정산합니다.";
    }

    return "";
  };

  const SettingsCard = (
    <div className="rounded-2xl bg-white text-green-950 p-4 mb-5 text-left">
      <h2 className="text-xl font-bold mb-4 text-center">설정</h2>

      <button
        onClick={() => setMuted(!muted)}
        className="w-full rounded-xl bg-green-950 text-white py-3 font-bold mb-4"
      >
        {muted ? "소리 켜기" : "소리 끄기"}
      </button>

      <p className="font-bold mb-2">효과음 크기</p>

      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        className="w-full"
      />

      <p className="text-center mt-2">{Math.round(volume * 100)}%</p>

      {screen === "game" && phase !== "finished" && (
        <button
          onClick={leaveCurrentGame}
          className="mt-5 w-full rounded-xl bg-red-500 text-white py-3 font-bold"
        >
          게임에서 나가기
        </button>
      )}
    </div>
  );

  const RulesCard = (
    <div className="rounded-2xl bg-white text-green-950 p-4 mb-5 text-sm leading-relaxed text-left">
      <h2 className="text-xl font-bold mb-4 text-center">룰 설명</h2>

      <div className="mb-4">
        <h3 className="font-bold text-lg mb-2">기본 진행</h3>
        <p className="mb-2">
          플레이어들은 순서대로 양치기가 되며, 양치기는 카드를 뽑고
          “늑대가 왔다” 또는 “평화롭다” 중 하나를 외칩니다.
        </p>
        <p>
          주민들은 양치기의 외침이 진실인지 거짓인지 판단하여
          <span className="text-blue-700 font-bold"> 신뢰</span> 또는
          <span className="text-red-700 font-bold"> 불신</span>에 베팅합니다.
        </p>
      </div>

      <div className="mb-4">
        <h3 className="font-bold text-lg mb-2">시작 양 / 베팅</h3>
        <p className="mb-2">
          게임 시작 시 각 플레이어는 플레이어 수의 2배만큼 양을 받습니다.
        </p>
        <p>
          주민은 최소 1마리부터 최대 플레이어 수만큼 베팅할 수 있습니다.
          단, 자신이 가진 양보다 많이 걸 수는 없습니다.
        </p>
      </div>

      <div className="mb-4">
        <h3 className="font-bold text-lg mb-2">주민 정산</h3>
        <p>
          주민은 양치기의 외침이 진실인지 거짓인지 맞추면 베팅한 만큼 양을
          얻고, 틀리면 베팅한 만큼 양을 잃습니다.
        </p>
      </div>

      <div className="mb-4">
        <h3 className="font-bold text-lg mb-2">양치기 정산</h3>
        <p className="mb-2">
          양치기가 진실을 말했을 때는
          <span className="font-bold"> 신뢰 인원 - 불신 인원</span> 만큼
          양을 얻거나 잃습니다.
        </p>
        <p>
          양치기가 거짓말을 했을 때는
          <span className="font-bold"> 2 × (신뢰 인원 - 불신 인원)</span> 만큼
          양을 얻거나 잃습니다.
        </p>
      </div>

      <div className="mb-4">
        <h3 className="font-bold text-lg mb-2">특수 룰</h3>

        <div className="space-y-2">
          <div className="rounded-xl bg-red-100 p-3">
            <p className="font-bold">늑대 - 진실 - 만장불신</p>
            <p>
              실제 늑대가 나왔고 양치기도 늑대를 외쳤지만 모든 주민이
              불신하면, 주민들은 각자 건 양의 2배를 잃습니다.
            </p>
          </div>

          <div className="rounded-xl bg-yellow-100 p-3">
            <p className="font-bold">늑대 - 거짓 - 만장신뢰</p>
            <p>
              실제 늑대가 나왔고 양치기가 평화라고 거짓말했는데 모든 주민이
              신뢰하면, 주민들은 각자 건 양의 2배를 잃습니다.
            </p>
          </div>

          <div className="rounded-xl bg-gray-100 p-3">
            <p className="font-bold">늑대 - 거짓 - 만장불신</p>
            <p>
              실제 늑대가 나왔고 양치기가 평화라고 거짓말했는데 모든 주민이
              불신하면, 양치기는 모든 양을 잃고 탈락합니다.
            </p>
          </div>

          <div className="rounded-xl bg-blue-100 p-3">
            <p className="font-bold">평화 - 진실 - 만장불신</p>
            <p>
              실제 평화가 나왔고 양치기도 평화를 외쳤지만 모든 주민이
              불신하면, 양치기는 -2 × (신뢰 인원 - 불신 인원)으로 정산합니다.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="font-bold text-lg mb-2">제한시간 / 기권</h3>
        <p className="mb-2">
          양치기가 제한시간 안에 외치지 못하면 양 2마리를 잃습니다.
        </p>
        <p>
          주민이 제한시간 안에 베팅하지 못하면 기권 처리되어 양 2마리를
          잃습니다. 기권자는 만장일치 특수룰 판정에서 제외됩니다.
        </p>
        <p className="mt-2">
          베팅 제한시간이 설정된 경우 마지막 설정된 블라인드 시간 동안은 블라인드 구간입니다.
          이때는 전체 신뢰/불신 수와 각 플레이어의 베팅 현황이 결과 공개 전까지 숨겨집니다.
        </p>
      </div>

      <div>
        <h3 className="font-bold text-lg mb-2">승리 조건</h3>
        <p>
          정해진 라운드가 모두 끝났을 때 가장 많은 양을 가진 플레이어가
          승리합니다. 양이 0마리가 되면 탈락합니다.
        </p>
      </div>
    </div>
  );

  if (screen === "game") {
    const isShepherd = playerName === shepherd;
    const isEliminated = !!playerScores[playerName]?.eliminated;
    const maxBet = Math.max(1, Math.min(players.length, mySheep));

    const previewBets: Record<string, Bet> = {
      ...liveBets,
      ...bets,
    };

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

    const isBettingBlind =
      phase === "betting" &&
      !!phaseEndsAt &&
      timeLeft > 0 &&
      blindTimeLimit > 0 && timeLeft <= blindTimeLimit;

    if (phase === "finished") {
      return (
        <main className="min-h-screen bg-green-950 text-white px-6 py-10">
          <h1 className="text-4xl font-bold mb-4">게임 종료</h1>

          <div className="rounded-2xl bg-yellow-300 text-green-950 p-6 mb-6">
            <p className="text-lg font-bold mb-2">
              {gameEndReason || "게임 종료"}
            </p>
            <h2 className="text-4xl font-bold">
              🏆 {winners.length > 0 ? winners.join(", ") : "우승자 없음"}
            </h2>
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
        <div className="flex justify-end gap-2 mb-3 flex-wrap">
          <button
            onClick={() => {
              playSound("click");
              setShowSettings(!showSettings);
            }}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold"
          >
            설정
          </button>

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

        <div className="mb-3 text-right text-xs text-green-200/80">
          방 코드: <span className="font-bold tracking-widest text-white">{roomCode}</span>
        </div>

        {showSettings && SettingsCard}
        {showRules && RulesCard}

        {showHistory && (
          <div className="rounded-2xl bg-white text-green-950 p-4 mb-5 overflow-x-auto">
            <h2 className="text-xl font-bold mb-4">외침 기록표</h2>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="border border-green-900 p-2">라운드</th>
                  <th className="border border-green-900 p-2">양치기</th>
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
                {Array.from({ length: totalRounds }, (_, i) => i + 1).map(
                  (roundNumber) => {
                    const playerNameForRound =
                      roundShepherds[String(roundNumber)];

                    return (
                      <tr key={roundNumber}>
                        <td className="border border-green-900 p-2 text-center">
                          {roundNumber}
                        </td>
                        <td className="border border-green-900 p-2 font-bold">
                          {playerNameForRound || "-"}
                        </td>

                        {Array.from(
                          { length: shoutsPerTurn },
                          (_, i) => i + 1
                        ).map((shoutNumber) => (
                          <td
                            key={shoutNumber}
                            className="border border-green-900 p-2 text-center"
                          >
                            {playerNameForRound &&
                            shoutHistory[playerNameForRound]?.[shoutNumber]
                              ? shoutHistory[playerNameForRound][
                                  shoutNumber
                                ] === "늑대"
                                ? "늑대가 왔다"
                                : "평화롭다"
                              : "-"}
                          </td>
                        ))}
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}

        {(phase === "shout" || phase === "betting") && phaseEndsAt && (
          <div
            className={`sticky top-3 z-40 rounded-2xl p-4 mb-4 text-center font-bold shadow-2xl border-2 ${
              timeLeft <= 10
                ? "bg-red-600 text-white border-yellow-300 animate-pulse"
                : "bg-red-500 text-white border-white/30"
            }`}
          >
            <div className="text-sm opacity-90">{timeLeft <= 10 ? "⚠️ 마지막 10초" : "남은 시간"}</div>
            <div className="text-3xl">
              {Math.floor(timeLeft / 60)}:
              {(timeLeft % 60).toString().padStart(2, "0")}
            </div>
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
            isBettingBlind ? (
              <div className="rounded-xl bg-black/40 text-white p-4 mb-4 text-center">
                <p className="text-lg font-bold">블라인드 구간</p>
                <p className="text-sm text-white/80 mt-1">
                  마지막 블라인드 구간 동안 베팅 현황은 숨겨집니다.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl bg-white text-green-950 p-3 text-center">
                  <p className="text-sm">전체 신뢰</p>
                  <p className="text-2xl font-bold text-blue-700">
                    🐑 {totalTrust}
                  </p>
                </div>

                <div className="rounded-xl bg-white/10 text-white p-3 text-center">
                  <p className="text-sm">전체 불신</p>
                  <p className="text-2xl font-bold text-red-400">
                    🐑 {totalDistrust}
                  </p>
                </div>
              </div>
            )
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
                      <div className="flex flex-col items-end">
                        <span>🐑 {player.sheep}</span>

                        {phase === "betting" && !isBettingBlind && previewBets[name] && (
                          <span
                            className={
                              previewBets[name].choice === "불신"
                                ? "text-xs text-red-400 font-bold"
                                : "text-xs text-blue-300 font-bold"
                            }
                          >
                            {previewBets[name].choice}{" "}
                            {previewBets[name].amount}
                          </span>
                        )}
                      </div>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {phase === "betting" && allResidentsBetted && (
          <button
            onClick={calculateResult}
            disabled={!isShepherd || isCalculating}
            className={`w-full rounded-2xl py-4 text-lg font-bold mb-6 ${
              isShepherd
                ? "bg-yellow-300 text-green-950"
                : "bg-white/20 text-white/60"
            }`}
          >
            {isCalculating
              ? "계산 중..."
              : isShepherd
              ? "결과 보기"
              : "양치기가 결과를 확인할 수 있습니다"}
          </button>
        )}

        {phase === "result" && (
          <div className="rounded-2xl bg-yellow-300 text-green-950 p-5 mb-6">
            <p className="text-lg font-bold mb-2">결과</p>

            <h2 className="text-3xl font-bold mb-5">
              {isTruth === null
                ? "시간 초과 처리"
                : isTruth
                ? "진실이었습니다"
                : "거짓이었습니다"}
            </h2>

            {isTruth !== null && (
              <div className="rounded-xl bg-white/60 p-4 mb-4">
                <p className="font-bold mb-2">이번 외침 정보</p>

                <p>
                  실제 카드:{" "}
                  <span
                    className={
                      currentCard === "늑대"
                        ? "text-red-700 font-bold"
                        : "text-blue-700 font-bold"
                    }
                  >
                    {currentCard === "늑대" ? "🐺 늑대" : "🐑 평화"}
                  </span>
                </p>

                <p>
                  양치기의 외침:{" "}
                  <span
                    className={
                      shout === "늑대"
                        ? "text-red-700 font-bold"
                        : "text-blue-700 font-bold"
                    }
                  >
                    {shout === "늑대" ? "늑대가 왔다!" : "평화롭다!"}
                  </span>
                </p>

                <p>
                  판정:{" "}
                  <span
                    className={
                      isTruth
                        ? "text-blue-700 font-bold"
                        : "text-red-700 font-bold"
                    }
                  >
                    {isTruth ? "진실" : "거짓"}
                  </span>
                </p>
              </div>
            )}

            {specialEvent && (
              <div className="rounded-2xl bg-red-500 text-white p-4 mb-5">
                <p className="text-center text-xl font-bold mb-2">
                  {specialEvent}
                </p>

                {getSpecialEventDescription(specialEvent) && (
                  <p className="text-sm leading-relaxed text-red-50">
                    {getSpecialEventDescription(specialEvent)}
                  </p>
                )}
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

                    <div className="flex flex-col items-end">
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

                      {bets[player.name] && (
                        <span
                          className={`text-xs mt-1 font-bold ${
                            bets[player.name].choice === "불신"
                              ? "text-red-700"
                              : "text-blue-700"
                          }`}
                        >
                          {bets[player.name].choice}{" "}
                          {bets[player.name].amount}
                        </span>
                      )}
                    </div>
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
              양이 0마리가 되어 탈락했습니다. 게임 진행은 계속 볼 수
              있습니다.
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
                <div className="text-6xl">🃏</div>
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
                <div className="text-7xl mb-3">
                  {getCardStyle(currentCard).emoji}
                </div>
                <div
                  className={`text-5xl font-bold ${
                    getCardStyle(currentCard).color
                  }`}
                >
                  {getCardStyle(currentCard).text}
                </div>

                {!shout && (
                  <div className="mt-6 flex flex-col gap-3">
                    <button
                      onClick={() => makeShout("늑대")}
                      className="w-full rounded-2xl bg-green-950 text-red-400 py-4 text-lg font-bold"
                    >
                      늑대가 왔다!
                    </button>

                    <button
                      onClick={() => makeShout("평화")}
                      className="w-full rounded-2xl border border-green-950 py-4 text-lg font-bold text-blue-600"
                    >
                      평화롭다
                    </button>
                  </div>
                )}

                {shout && (
                  <p className="mt-6 text-2xl font-bold">
                    외침:{" "}
                    <span
                      className={
                        shout === "늑대" ? "text-red-600" : "text-blue-600"
                      }
                    >
                      {shout === "늑대" ? "늑대가 왔다!" : "평화롭다!"}
                    </span>
                  </p>
                )}
              </div>
            )}

            {phase === "betting" && !allResidentsBetted && (
              <div className="rounded-2xl bg-white/10 p-4 mt-6 text-center">
                <p className="text-green-100">
                  주민들의 베팅을 기다리는 중입니다.
                </p>
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
                <p className="text-green-100 mb-4">
                  양치기가 카드를 뽑는 중...
                </p>
                <div className="text-6xl">🃏</div>
              </div>
            ) : !shout ? (
              <p className="text-green-100">양치기의 외침을 기다리세요.</p>
            ) : bets[playerName] ? (
              <div className="rounded-2xl bg-white/10 p-5">
                <p className="text-green-200 mb-2">베팅 완료</p>
                <p
                  className={`text-2xl font-bold ${
                    bets[playerName].choice === "불신"
                      ? "text-red-400"
                      : "text-blue-300"
                  }`}
                >
                  {bets[playerName].choice} / 양 {bets[playerName].amount}마리
                </p>
              </div>
            ) : (
              <div>
                <div className="rounded-2xl bg-white/10 p-5 mb-6">
                  <p className="text-green-200 mb-2">양치기의 외침</p>
                  <h2
                    className={`text-4xl font-bold ${
                      shout === "늑대" ? "text-red-400" : "text-blue-300"
                    }`}
                  >
                    {shout === "늑대" ? "늑대가 왔다!" : "평화롭다!"}
                  </h2>
                </div>

                {specialRulesDisabled &&
                  forcedDistrustShepherd === shepherd && (
                    <div className="rounded-2xl bg-red-500 text-white p-4 mb-4 text-center font-bold">
                      특수룰 효과: 불신 베팅 2마리 고정
                    </div>
                  )}

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div
                    className={`rounded-2xl p-4 text-center ${
                      specialRulesDisabled &&
                      forcedDistrustShepherd === shepherd
                        ? "bg-gray-400 text-gray-700"
                        : "bg-white text-green-950"
                    }`}
                  >
                    <p className="font-bold mb-3 text-blue-700">신뢰</p>

                    <button
                      onClick={async () => {
                        playSound("sheep");
                        if (
                          specialRulesDisabled &&
                          forcedDistrustShepherd === shepherd
                        )
                          return;
                        if (trustAmount >= maxBet) return;

                        const nextAmount = trustAmount + 1;

                        setDistrustAmount(0);
                        setTrustAmount(nextAmount);

                        await set(
                          ref(
                            database,
                            `rooms/${roomCode}/liveBets/${playerName}`
                          ),
                          {
                            name: playerName,
                            choice: "신뢰",
                            amount: nextAmount,
                          }
                        );
                      }}
                      className="w-full rounded-xl bg-green-950 text-white py-2 font-bold"
                    >
                      +
                    </button>

                    <div className="text-4xl font-bold my-4">
                      {trustAmount}
                    </div>

                    <button
                      onClick={async () => {
                        playSound("sheep");
                        if (
                          specialRulesDisabled &&
                          forcedDistrustShepherd === shepherd
                        )
                          return;

                        const nextAmount = Math.max(0, trustAmount - 1);
                        setTrustAmount(nextAmount);

                        await set(
                          ref(
                            database,
                            `rooms/${roomCode}/liveBets/${playerName}`
                          ),
                          nextAmount > 0
                            ? {
                                name: playerName,
                                choice: "신뢰",
                                amount: nextAmount,
                              }
                            : null
                        );
                      }}
                      className="w-full rounded-xl bg-green-950 text-white py-2 font-bold"
                    >
                      -
                    </button>
                  </div>

                  <div className="rounded-2xl bg-white/10 text-white p-4 text-center">
                    <p className="font-bold mb-3 text-red-400">불신</p>

                    <button
                      onClick={async () => {
                        playSound("sheep");
                        if (distrustAmount >= maxBet) return;

                        const nextAmount = distrustAmount + 1;

                        setTrustAmount(0);
                        setDistrustAmount(nextAmount);

                        await set(
                          ref(
                            database,
                            `rooms/${roomCode}/liveBets/${playerName}`
                          ),
                          {
                            name: playerName,
                            choice: "불신",
                            amount: nextAmount,
                          }
                        );
                      }}
                      className="w-full rounded-xl bg-white text-green-950 py-2 font-bold"
                    >
                      +
                    </button>

                    <div className="text-4xl font-bold my-4">
                      {specialRulesDisabled &&
                      forcedDistrustShepherd === shepherd
                        ? Math.min(forcedDistrustAmount || 2, mySheep)
                        : distrustAmount}
                    </div>

                    <button
                      onClick={async () => {
                        playSound("sheep");
                        if (
                          specialRulesDisabled &&
                          forcedDistrustShepherd === shepherd
                        )
                          return;

                        const nextAmount = Math.max(0, distrustAmount - 1);
                        setDistrustAmount(nextAmount);

                        await set(
                          ref(
                            database,
                            `rooms/${roomCode}/liveBets/${playerName}`
                          ),
                          nextAmount > 0
                            ? {
                                name: playerName,
                                choice: "불신",
                                amount: nextAmount,
                              }
                            : null
                        );
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
                  setTotalRounds(Math.max(0, totalRounds - 1));
                }}
                className="rounded-xl bg-white text-green-950 px-5 py-2 font-bold"
              >
                -
              </button>
              <span className="text-3xl font-bold">
                {totalRounds === 0 ? "자동" : totalRounds}
              </span>
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
            <p className="text-xs text-green-100 mt-3">
              자동일 경우 게임 시작 시 플레이어 수 × 3으로 설정됩니다.
            </p>
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
                  setStartingSheep(Math.max(0, startingSheep - 1));
                }}
                className="rounded-xl bg-white text-green-950 px-5 py-2 font-bold"
              >
                -
              </button>
              <span className="text-3xl font-bold">
                {startingSheep === 0 ? "자동" : startingSheep}
              </span>
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
            <p className="text-xs text-green-100 mt-3">
              자동일 경우 게임 시작 시 플레이어 수 × 2로 설정됩니다.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-4">
            <p className="font-bold mb-3">외침 제한시간(초)</p>
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  playSound("click");
                  setShoutTimeLimit(Math.max(0, shoutTimeLimit - 5));
                }}
                className="rounded-xl bg-white text-green-950 px-5 py-2 font-bold"
              >
                -
              </button>
              <span className="text-3xl font-bold">
                {shoutTimeLimit === 0 ? "없음" : shoutTimeLimit}
              </span>
              <button
                onClick={() => {
                  playSound("click");
                  setShoutTimeLimit(shoutTimeLimit + 5);
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
                  setBetTimeLimit(Math.max(0, betTimeLimit - 10));
                }}
                className="rounded-xl bg-white text-green-950 px-5 py-2 font-bold"
              >
                -
              </button>
              <span className="text-3xl font-bold">
                {betTimeLimit === 0 ? "없음" : betTimeLimit}
              </span>
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

          <div className="rounded-2xl bg-white/10 p-4">
            <p className="font-bold mb-3">블라인드 시간(초)</p>
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  playSound("click");
                  setBlindTimeLimit(Math.max(0, blindTimeLimit - 5));
                }}
                className="rounded-xl bg-white text-green-950 px-5 py-2 font-bold"
              >
                -
              </button>
              <span className="text-3xl font-bold">
                {blindTimeLimit === 0 ? "없음" : blindTimeLimit}
              </span>
              <button
                onClick={() => {
                  playSound("click");
                  setBlindTimeLimit(blindTimeLimit + 5);
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
          placeholder="이름 입력"
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
          설정: 총 라운드 {totalRounds === 0 ? "자동(플레이어 수 × 3)" : totalRounds} / 외침 {shoutsPerTurn}번 / 시작 양 {startingSheep === 0 ? "자동(플레이어 수 × 2)" : startingSheep}
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
    <main className="min-h-screen bg-green-950 text-white flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm text-center">
        <div className="text-6xl mb-6">🐑</div>

        <h1 className="text-4xl font-bold mb-3">양치기 게임</h1>

        <p className="text-green-100 mb-6 leading-relaxed">
          양치기 소년의 외침을 믿을지, 의심할지 선택하세요.
        </p>

        <div className="flex justify-center gap-3 mb-6">
          <button
            onClick={() => {
              playSound("click");
              setShowRules(!showRules);
            }}
            className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold"
          >
            {showRules ? "룰 닫기" : "룰 설명"}
          </button>

          <button
            onClick={() => {
              playSound("click");
              setShowSettings(!showSettings);
            }}
            className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold"
          >
            설정
          </button>
        </div>

        {showSettings && SettingsCard}
        {showRules && RulesCard}

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

        <div className="mt-6 rounded-2xl bg-white/10 p-4 text-sm text-green-100 leading-relaxed">
          <p className="mb-3">
            이 게임은 우왁굳 콘텐츠에서 소개된 양치기 소년 게임 룰을
            바탕으로 제작되었습니다. 원 룰 정리와 아이디어에 도움을 준
            김눈눈님과 우왁굳님께 감사드립니다. 이 게임은 비공식 팬 게임이며
            어느 영리적인 목적으로도 사용되지 않습니다.
            <br />
            <br />
            개발자: 김용하, 강효식, 이선
            <br />
            테스터: 이용원, 김소영, 송자영, 조태훈, 이연주, 김민하
          </p>

          <div className="flex flex-col gap-3">
            <a
              href="https://cafe.naver.com/f-e/cafes/27842958/articles/18127919?boardtype=L&referrerAllArticles=true&inCafeSearch=true&query=%EC%96%91%EC%B9%98%EA%B8%B0%20%EB%A3%B0&art=aW50ZXJuYWwtY2FmZS1hcnRpY2xlLXJlYWQtaW5DYWZlLXNlYXJjaC1saXN0.eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJjYWZlVHlwZSI6IkNBRkVfSUQiLCJhcnRpY2xlSWQiOjE4MTI3OTE5LCJpc3N1ZWRBdCI6MTc3ODk2MTE5NTcyNywiY2FmZUlkIjoyNzg0Mjk1OH0.EUtJL8ZBNvshvNu4PdHrwxOgE3BA2p4oMKhbCGdRU4I&page=2"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-white text-green-950 px-4 py-3 font-bold text-center"
            >
              출처 보기
            </a>

            <a
              href="https://www.youtube.com/watch?v=CFxYT9f1jic"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-red-500 text-white px-4 py-3 font-bold text-center"
            >
              룰 영상 보기
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
