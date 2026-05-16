"use client";

import { useState } from "react";
import { database } from "@/lib/firebase";
import { ref, set } from "firebase/database";

type Screen = "home" | "create" | "join" | "name" | "lobby";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [players, setPlayers] = useState<string[]>([]);

  const createRoom = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setRoomCode(code);
    setScreen("name");
  };

  const joinRoom = () => {
    if (!roomCode.trim()) return;
    setScreen("name");
  };

  const enterLobby = async () => {
    if (!playerName.trim()) return;

    await set(ref(database, `rooms/${roomCode}/players/${playerName}`), {
      name: playerName,
    });

    setPlayers([playerName]);
    setScreen("lobby");
  };

  if (screen === "create") {
    return (
      <main className="min-h-screen bg-green-950 text-white px-6 py-10">
        <button onClick={() => setScreen("home")} className="mb-8 text-green-200">
          ← 뒤로
        </button>

        <h1 className="text-3xl font-bold mb-4">방 만들기</h1>
        <p className="text-green-100 mb-8">친구들이 들어올 방을 만듭니다.</p>

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
        <button onClick={() => setScreen("home")} className="mb-8 text-green-200">
          ← 뒤로
        </button>

        <h1 className="text-3xl font-bold mb-4">방 참가하기</h1>

        <input
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          className="w-full rounded-2xl bg-white px-4 py-4 text-green-950 text-lg mb-4"
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
        <button onClick={() => setScreen("home")} className="mb-8 text-green-200">
          ← 처음으로
        </button>

        <p className="text-green-200 mb-2">방 코드</p>
        <div className="text-5xl font-bold tracking-widest mb-10">{roomCode}</div>

        <h1 className="text-3xl font-bold mb-4">이름 입력</h1>

        <input
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          className="w-full rounded-2xl bg-white px-4 py-4 text-green-950 text-lg mb-4"
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
        <div className="text-5xl font-bold tracking-widest mb-8">{roomCode}</div>

        <h1 className="text-3xl font-bold mb-4">대기방</h1>
        <p className="text-green-100 mb-6">참가자들이 모이면 게임을 시작하세요.</p>

        <div className="space-y-3 mb-8">
          {players.map((player, index) => (
            <div key={index} className="rounded-2xl bg-white/10 px-4 py-4 text-lg">
              🐑 {player}
            </div>
          ))}
        </div>

        <button className="w-full rounded-2xl bg-white text-green-950 py-4 text-lg font-bold">
          게임 시작
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-green-950 text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="text-6xl mb-6">🐑</div>

        <h1 className="text-4xl font-bold mb-3">양치기 게임</h1>

        <p className="text-green-100 mb-10 leading-relaxed">
          마을 사람들 사이에 숨어 있는 늑대를 찾아내세요.
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