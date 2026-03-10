'use client';

export function GlowOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      {/* 主光晕 - 暖琥珀色 */}
      <div
        className="glow-orb w-[480px] h-[480px]"
        style={{
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.18) 0%, rgba(217, 119, 6, 0.08) 40%, transparent 70%)',
          top: '3%',
          left: '12%',
          animationDelay: '0s',
        }}
      />

      {/* 次光晕 - 朱砂红 */}
      <div
        className="glow-orb w-[380px] h-[380px]"
        style={{
          background: 'radial-gradient(circle, rgba(220, 38, 38, 0.12) 0%, rgba(185, 28, 28, 0.06) 40%, transparent 70%)',
          top: '55%',
          right: '6%',
          animationDelay: '2.5s',
        }}
      />

      {/* 小光晕 - 金色 */}
      <div
        className="glow-orb w-[280px] h-[280px]"
        style={{
          background: 'radial-gradient(circle, rgba(251, 191, 36, 0.1) 0%, transparent 60%)',
          bottom: '12%',
          left: '38%',
          animationDelay: '5s',
        }}
      />

      {/* 顶部渐变 - 温暖光 */}
      <div
        className="absolute inset-x-0 top-0 h-64"
        style={{
          background: 'linear-gradient(to bottom, rgba(245, 158, 11, 0.05) 0%, transparent 100%)',
        }}
      />

      {/* 底部暗角 */}
      <div
        className="absolute inset-x-0 bottom-0 h-40"
        style={{
          background: 'linear-gradient(to top, rgba(12, 10, 9, 0.4) 0%, transparent 100%)',
        }}
      />
    </div>
  );
}
