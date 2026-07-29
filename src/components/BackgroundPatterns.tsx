"use client";

import React, { useState, useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
}

export type PatternType = "constellation" | "geometric" | "cybergrid" | "aurora";

export default function BackgroundPatterns() {
  const [activePattern, setActivePattern] = useState<PatternType>("constellation");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Constellation Canvas Loop
  useEffect(() => {
    if (activePattern !== "constellation") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    const particleCount = Math.min(180, Math.floor((width * height) / 7500));
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        radius: Math.random() * 2.8 + 1.8,
        alpha: Math.random() * 0.5 + 0.45,
      });
    }

    let mouseX = -1000;
    let mouseY = -1000;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    window.addEventListener("mousemove", handleMouseMove);

    const maxDistance = 175;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(79, 70, 229, ${p.alpha})`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            const lineAlpha = (1 - dist / maxDistance) * 0.55;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(99, 102, 241, ${lineAlpha})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }

        if (mouseX > 0 && mouseY > 0) {
          const mdx = p.x - mouseX;
          const mdy = p.y - mouseY;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

          if (mdist < 200) {
            const mAlpha = (1 - mdist / 200) * 0.65;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouseX, mouseY);
            ctx.strokeStyle = `rgba(79, 70, 229, ${mAlpha})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [activePattern]);

  return (
    <>
      {/* Pattern 1: Constellation Network Canvas */}
      {activePattern === "constellation" && (
        <canvas
          ref={canvasRef}
          className="fixed inset-0 pointer-events-none z-0 w-full h-full animate-in fade-in duration-500"
        />
      )}

      {/* Pattern 2: 3D Floating Glass & Polygon Shapes */}
      {activePattern === "geometric" && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden animate-in fade-in duration-500">
          <div className="absolute top-[15%] left-[10%] w-32 h-32 rounded-3xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 backdrop-blur-md border border-indigo-200/40 shadow-xl rotate-12 animate-float-slow"></div>
          <div className="absolute bottom-[20%] right-[12%] w-40 h-40 rounded-full bg-gradient-to-br from-blue-400/20 to-emerald-400/20 backdrop-blur-md border border-blue-200/40 shadow-2xl animate-float-reverse"></div>
          <div className="absolute top-[60%] left-[8%] w-24 h-24 rounded-2xl bg-gradient-to-bl from-pink-400/20 to-purple-400/20 backdrop-blur-md border border-pink-200/40 -rotate-45 animate-float-slow" style={{ animationDelay: "1.5s" }}></div>
          <div className="absolute top-[25%] right-[18%] w-28 h-28 border-4 border-indigo-300/30 rounded-3xl rotate-45 animate-float-reverse"></div>
          <div className="absolute bottom-[15%] left-[25%] w-36 h-36 border-2 border-purple-300/30 rounded-full animate-float-slow"></div>
        </div>
      )}

      {/* Pattern 3: Cyber Dot Matrix & Grid Pattern */}
      {activePattern === "cybergrid" && (
        <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(#6366f1_1.2px,transparent_1.2px)] [background-size:28px_28px] opacity-40 animate-in fade-in duration-500">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-slate-50 opacity-80"></div>
        </div>
      )}

      {/* Pattern 4: Aurora Wave Gradient */}
      {activePattern === "aurora" && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden animate-in fade-in duration-500">
          <div className="absolute -top-[30%] left-[20%] w-[700px] h-[700px] rounded-full bg-gradient-to-r from-indigo-300/40 via-purple-300/40 to-pink-300/40 blur-[120px] animate-pulse-glow"></div>
          <div className="absolute -bottom-[30%] right-[10%] w-[650px] h-[650px] rounded-full bg-gradient-to-r from-blue-300/40 via-emerald-300/40 to-indigo-300/40 blur-[120px] animate-pulse-glow" style={{ animationDelay: "3s" }}></div>
        </div>
      )}

      {/* Pattern Selector Pill Switcher */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1.5 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-lg shadow-slate-300/40 select-none">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-2">
          Pattern:
        </span>
        {[
          { id: "constellation", label: "🌌 Network" },
          { id: "geometric", label: "📐 3D Shapes" },
          { id: "cybergrid", label: "🌐 Cyber Grid" },
          { id: "aurora", label: "🌈 Aurora Wave" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActivePattern(item.id as PatternType)}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-xl transition-all cursor-pointer ${
              activePattern === item.id
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
