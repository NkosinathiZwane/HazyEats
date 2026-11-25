import { useEffect, useState } from 'react';

// ZikCode intro: "Zik" rises from the bottom, "Code" drops from the top, then it fades after 1.8 seconds.
export default function Splash() {
  const [phase, setPhase] = useState('show');
  useEffect(() => {
    const a = setTimeout(() => setPhase('fade'), 1700);
    const b = setTimeout(() => setPhase('gone'), 2100);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  if (phase === 'gone') return null;
  return (
    <div id="splash-screen" style={{ opacity: phase === 'fade' ? 0 : 1 }} aria-hidden="true">
      <div className="zikcode-wrap">
        <span className="zik-part">Zik</span><span className="code-part">Code</span>
      </div>
    </div>
  );
}
