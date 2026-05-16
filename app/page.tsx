export default function Home() {
  return (
    <main className="min-h-screen bg-green-950 text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="text-6xl mb-6">🐑</div>

        <h1 className="text-4xl font-bold mb-3">양치기 게임</h1>

        <p className="text-green-100 mb-10 leading-relaxed">
          마을 사람들 사이에 숨어 있는 늑대를 찾아내세요.
        </p>

        <div className="flex flex-col gap-4">
          <button className="w-full rounded-2xl bg-white text-green-950 py-4 text-lg font-bold">
            방 만들기
          </button>

          <button className="w-full rounded-2xl border border-white/40 py-4 text-lg font-bold">
            방 참가하기
          </button>
        </div>
      </div>
    </main>
  );
}