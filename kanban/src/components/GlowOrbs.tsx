'use client';

export function GlowOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      {/* 主光晕 - 紫色 */}
      <div
        className="glow-orb w-96 h-96"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)',
          top: '10%',
          left: '20%',
          animationDelay: '0s',
        }}
      />

      {/* 次光晕 - 蓝色 */}
      <div
        className="glow-orb w-80 h-80"
        style={{
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 70%)',
          top: '60%',
          right: '10%',
          animationDelay: '2s',
        }}
      />

      {/* 小光晕 - 青色 */}
      <div
        className="glow-orb w-64 h-64"
        style={{
          background: 'radial-gradient(circle, rgba(34, 211, 238, 0.2) 0%, transparent 70%)',
          bottom: '20%',
          left: '40%',
          animationDelay: '4s',
        }}
      />

      {/* 顶部渐变 */}
      <div
        className="absolute inset-x-0 top-0 h-64"
        style={{
          background: 'linear-gradient(to bottom, rgba(139, 92, 246, 0.1) 0%, transparent 100%)',
        }}
      />
    </div>
  );
}
