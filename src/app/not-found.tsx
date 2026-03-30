export default function NotFound() {
  return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center">
      <div className="text-5xl font-black" style={{ color: '#c93a3a' }}>404</div>
      <p className="text-gray-400 mt-2 font-mono">Target not found</p>
      <a href="/" className="mt-4 px-6 py-2 font-bold text-sm uppercase"
        style={{ background: '#d4a24e', color: '#1a1f16' }}>
        RETURN TO BASE
      </a>
    </div>
  );
}
