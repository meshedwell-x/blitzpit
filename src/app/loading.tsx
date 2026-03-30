export default function Loading() {
  return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center">
      <div className="text-3xl font-black tracking-wider" style={{ color: '#e8e0d0' }}>
        BLITZ<span style={{ color: '#c93a3a' }}>PIT</span>
      </div>
      <div className="mt-4 w-32 h-1 bg-gray-800 rounded overflow-hidden">
        <div className="h-full bg-red-600 rounded animate-pulse" style={{ width: '60%' }} />
      </div>
      <p className="mt-3 text-xs font-mono" style={{ color: '#6b6356' }}>Loading battlefield...</p>
    </div>
  );
}
