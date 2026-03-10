"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Rect = { x: number; y: number; w: number; h: number };
type Phase = "landing" | "countdown" | "playing" | "failed" | "scare";

interface LevelConfig {
    id: number;
    title: string;
    subtitle: string;
    pathColor: string;
    corridors: Rect[];
    ballStart: { x: number; y: number };
    exitCheckX: number;
}

const BALL_RADIUS = 9;
const CW = 800, CH = 600;

// ─── Level Definitions ────────────────────────────────────────────────────────
const LEVELS: LevelConfig[] = [
    // Level 1 — wide (65 px)
    {
        id: 1, title: "LEVEL 1", subtitle: "INITIATION", pathColor: "#f0ede6",
        corridors: [
            { x: 0, y: 270, w: 200, h: 65 },
            { x: 150, y: 100, w: 65, h: 235 },
            { x: 150, y: 100, w: 450, h: 65 },
            { x: 535, y: 100, w: 65, h: 300 },
            { x: 535, y: 335, w: 265, h: 65 },
        ],
        ballStart: { x: 20, y: 302 }, exitCheckX: 790,
    },
    // Level 2 — medium (42 px)
    {
        id: 2, title: "LEVEL 2", subtitle: "CONSTRICTION", pathColor: "#e6ddd2",
        corridors: [
            { x: 0, y: 279, w: 120, h: 42 },
            { x: 80, y: 80, w: 42, h: 241 },
            { x: 80, y: 80, w: 370, h: 42 },
            { x: 408, y: 80, w: 42, h: 260 },
            { x: 200, y: 298, w: 250, h: 42 },
            { x: 200, y: 148, w: 42, h: 192 },
            { x: 200, y: 148, w: 600, h: 42 },
        ],
        ballStart: { x: 20, y: 300 }, exitCheckX: 790,
    },
    // Level 3 — narrow (26 px)
    {
        id: 3, title: "LEVEL 3", subtitle: "FINAL TRIAL", pathColor: "#dbd1c2",
        corridors: [
            { x: 0, y: 287, w: 80, h: 26 },
            { x: 55, y: 50, w: 26, h: 263 },
            { x: 55, y: 50, w: 545, h: 26 },
            { x: 574, y: 50, w: 26, h: 300 },
            { x: 250, y: 324, w: 350, h: 26 },
            { x: 250, y: 150, w: 26, h: 200 },
            { x: 250, y: 150, w: 450, h: 26 },
            { x: 674, y: 150, w: 26, h: 330 },
            { x: 100, y: 454, w: 600, h: 26 },
            { x: 100, y: 230, w: 26, h: 250 },
            { x: 100, y: 230, w: 700, h: 26 },
        ],
        ballStart: { x: 20, y: 300 }, exitCheckX: 790,
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function inCorridor(x: number, y: number, c: Rect[]): boolean {
    return c.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ScaryMaze() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [phase, setPhase] = useState<Phase>("landing");
    const [currentLevel, setCurrentLevel] = useState(0);
    const [failCount, setFailCount] = useState(0);
    const [scareVisible, setScareVisible] = useState(false);
    const [countdown, setCountdown] = useState(3);

    const phaseRef = useRef<Phase>("landing");
    const currentLevelRef = useRef(0);
    const ballPosRef = useRef({ x: 20, y: 302 });
    const animFrameRef = useRef(0);
    const rippleRef = useRef<{ x: number; y: number; r: number; alpha: number }[]>([]);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    phaseRef.current = phase;
    currentLevelRef.current = currentLevel;

    // ── Audio ───────────────────────────────────────────────────────────────────
    const ensureAudio = useCallback(() => {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    }, []);

    const playScream = useCallback(() => {
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        const now = ctx.currentTime;
        const bufSize = ctx.sampleRate * 3;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++)
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 1.5));
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(1200, now);
        bp.frequency.linearRampToValueAtTime(3500, now + 0.3);
        bp.Q.value = 0.5;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(5, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 2.5);
        src.connect(bp); bp.connect(gain); gain.connect(ctx.destination);
        src.start(now);
    }, []);

    // ── Draw loop ───────────────────────────────────────────────────────────────
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const level = LEVELS[currentLevelRef.current];

        ctx.fillStyle = "#0c0c0c";
        ctx.fillRect(0, 0, CW, CH);

        level.corridors.forEach((r) => {
            ctx.fillStyle = level.pathColor;
            ctx.fillRect(r.x, r.y, r.w, r.h);
        });

        // Grid texture
        const step = 18;
        ctx.strokeStyle = "rgba(0,0,0,0.06)";
        ctx.lineWidth = 1;
        for (let gx = 0; gx < CW; gx += step)
            for (let gy = 0; gy < CH; gy += step)
                if (inCorridor(gx + step / 2, gy + step / 2, level.corridors))
                    ctx.strokeRect(gx, gy, step, step);

        // Exit glow
        const last = level.corridors[level.corridors.length - 1];
        const eg = ctx.createLinearGradient(730, last.y, CW, last.y + last.h);
        eg.addColorStop(0, "rgba(34,197,94,0)");
        eg.addColorStop(1, "rgba(34,197,94,0.55)");
        ctx.fillStyle = eg;
        ctx.fillRect(730, last.y, 70, last.h);
        ctx.font = "bold 11px monospace";
        ctx.fillStyle = "#16a34a";
        ctx.fillText("EXIT", 742, last.y + last.h / 2 + 4);

        // Level indicator
        ctx.font = "bold 12px monospace";
        ctx.fillStyle = level.id === 3 ? "#dc2626" : "#555";
        ctx.fillText(`LVL ${level.id} / 3`, 8, 18);

        // Ripples
        rippleRef.current = rippleRef.current.filter((rp) => rp.alpha > 0.01);
        for (const rp of rippleRef.current) {
            ctx.beginPath();
            ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(230,57,70,${rp.alpha})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            rp.r += 2; rp.alpha -= 0.035;
        }

        // Ball
        const { x: bx, y: by } = ballPosRef.current;
        const gr = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, BALL_RADIUS);
        gr.addColorStop(0, "#ff6b6b"); gr.addColorStop(1, "#c1121f");
        ctx.beginPath();
        ctx.arc(bx, by, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = gr;
        ctx.shadowColor = "#e63946";
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.shadowBlur = 0;

        animFrameRef.current = requestAnimationFrame(draw);
    }, []);

    useEffect(() => {
        animFrameRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [draw]);

    // ── Start level with 3-second countdown ────────────────────────────────────
    const startLevel = useCallback((idx: number) => {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

        ballPosRef.current = { ...LEVELS[idx].ballStart };
        currentLevelRef.current = idx;
        setCurrentLevel(idx);
        setCountdown(3);
        setPhase("countdown");
        phaseRef.current = "countdown";

        let n = 3;
        countdownTimerRef.current = setInterval(() => {
            n--;
            if (n <= 0) {
                clearInterval(countdownTimerRef.current!);
                setPhase("playing");
                phaseRef.current = "playing";
                setTimeout(() => canvasRef.current?.requestPointerLock(), 60);
            } else {
                setCountdown(n);
            }
        }, 1000);
    }, []);

    // ── Pointer lock mouse delta tracking ──────────────────────────────────────
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (phaseRef.current !== "playing") return;
            if (document.pointerLockElement !== canvasRef.current) return;

            const level = LEVELS[currentLevelRef.current];
            const prev = ballPosRef.current;
            const nx = Math.max(0, Math.min(CW, prev.x + e.movementX));
            const ny = Math.max(0, Math.min(CH, prev.y + e.movementY));
            ballPosRef.current = { x: nx, y: ny };

            if (nx >= level.exitCheckX && inCorridor(nx, ny, level.corridors)) {
                if (currentLevelRef.current >= LEVELS.length - 1) {
                    // Final level — exit lock and show jumpscare
                    document.exitPointerLock();
                    phaseRef.current = "scare";
                    setPhase("scare");
                    setTimeout(() => { setScareVisible(true); playScream(); }, 80);
                } else {
                    // Seamless advance: keep pointer lock active, just swap level data
                    const nextIdx = currentLevelRef.current + 1;
                    ballPosRef.current = { ...LEVELS[nextIdx].ballStart };
                    currentLevelRef.current = nextIdx;
                    setCurrentLevel(nextIdx);
                    // phase stays "playing", pointer lock stays active — mouse works immediately
                }
                return;
            }

            if (!inCorridor(nx, ny, level.corridors)) {
                for (let i = 0; i < 3; i++)
                    rippleRef.current.push({ x: nx, y: ny, r: BALL_RADIUS + i * 4, alpha: 0.9 - i * 0.25 });
                document.exitPointerLock();
                phaseRef.current = "failed";
                setPhase("failed");
                setFailCount((c) => c + 1);
            }
        };

        document.addEventListener("mousemove", onMove);
        return () => document.removeEventListener("mousemove", onMove);
    }, [playScream]);

    // Escape / external pointer-lock loss
    useEffect(() => {
        const onLockChange = () => {
            if (document.pointerLockElement === null && phaseRef.current === "playing") {
                phaseRef.current = "failed";
                setPhase("failed");
                setFailCount((c) => c + 1);
            }
        };
        document.addEventListener("pointerlockchange", onLockChange);
        return () => document.removeEventListener("pointerlockchange", onLockChange);
    }, []);



    const handleBegin = () => { ensureAudio(); startLevel(0); };
    // Failure always resets to level 1
    const handleRetry = () => { ensureAudio(); startLevel(0); };
    const handleScareClick = () => {
        setScareVisible(false);
        setPhase("landing");
        setCurrentLevel(0);
        currentLevelRef.current = 0;
        ballPosRef.current = { ...LEVELS[0].ballStart };
    };

    const showCanvas = ["countdown", "playing", "failed"].includes(phase);
    const lvl = LEVELS[currentLevel];

    // ── Shared class strings ────────────────────────────────────────────────────
    const overlayBase = "absolute inset-0 flex items-center justify-center rounded z-20";
    const btnBase =
        "border border-[#e63946] bg-transparent text-[#e63946] font-mono font-bold " +
        "tracking-[0.1em] rounded cursor-pointer transition-all duration-200 " +
        "hover:bg-[#e63946] hover:text-white hover:shadow-[0_0_22px_rgba(230,57,70,0.4)]";

    return (
        /* Root */
        <div
            className="w-screen h-screen flex items-center justify-center antialiased"
            style={{ background: "radial-gradient(ellipse at center, #150505 0%, #0a0a0a 65%)" }}
        >
            {/* ── Canvas area ─────────────────────────────────────────────────────── */}
            <div className="relative" style={{ display: showCanvas ? "block" : "none" }}>
                <canvas
                    ref={canvasRef}
                    width={CW}
                    height={CH}
                    className="block border-2 border-[#1e1e1e] rounded-[6px] cursor-none max-w-[95vw] max-h-[88vh] w-auto h-auto"
                    style={{ boxShadow: "0 0 60px rgba(0,0,0,.85), 0 0 3px rgba(230,57,70,0.4)" }}
                />

                {/* Countdown overlay */}
                {phase === "countdown" && (
                    <div className={`${overlayBase} bg-[rgba(8,0,0,0.82)] backdrop-blur-md animate-fade-in`}>
                        <div className="flex flex-col items-center gap-3 text-center">
                            <p className="font-mono text-[0.75rem] tracking-[0.22em] text-[#666] uppercase">
                                {lvl.title} — {lvl.subtitle}
                            </p>
                            <div
                                className="font-mono font-black leading-none text-[#e63946] animate-countdown-pop"
                                style={{
                                    fontSize: "clamp(5rem,18vw,9rem)",
                                    textShadow: "0 0 40px rgba(230,57,70,0.4), 0 0 100px rgba(230,57,70,.2)",
                                }}
                            >
                                {countdown}
                            </div>
                            <p className="text-[0.8rem] text-[#666] tracking-[0.06em]">
                                Centre your cursor, then get ready…
                            </p>
                        </div>
                    </div>
                )}

                {/* Failed overlay */}
                {phase === "failed" && (
                    <div className={`${overlayBase} bg-[rgba(8,0,0,0.88)] backdrop-blur-[5px] animate-fade-in`}>
                        <div className="flex flex-col items-center gap-[14px] text-center px-12 py-9">
                            <span className="text-[48px] animate-shake">💀</span>
                            <h2
                                className="font-mono font-extrabold tracking-[0.14em] text-[#e63946]"
                                style={{
                                    fontSize: "clamp(1.1rem,3vw,1.7rem)",
                                    textShadow: "0 0 20px rgba(230,57,70,0.4)",
                                }}
                            >
                                WALL CONTACT
                            </h2>
                            <span className="font-mono text-[0.72rem] text-[#dc2626] tracking-[0.16em] border border-[#dc262640] px-3 py-[3px] rounded-full">
                                Failed on {lvl.title} — Back to Level 1
                            </span>
                            <p className="text-[0.85rem] text-[#888] tracking-[0.04em]">
                                {failCount < 3
                                    ? "Steady your hand."
                                    : failCount < 8
                                        ? `${failCount} total failures. Don't rush.`
                                        : `${failCount} total failures. Embarrassing.`}
                            </p>
                            <button id="btn-retry" className={`${btnBase} px-7 py-[10px] text-[0.92rem]`} onClick={handleRetry}>
                                Start Over
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Landing screen ───────────────────────────────────────────────────── */}
            {phase === "landing" && (
                <div className="flex items-center justify-center w-full h-full animate-fade-in">
                    <div className="flex flex-col items-center gap-10 text-center">
                        <h1
                            className="font-mono font-black text-[#e63946] tracking-[0.06em] uppercase animate-pulse-glow"
                            style={{
                                fontSize: "clamp(3rem,10vw,6rem)",
                                textShadow: "0 0 28px rgba(230,57,70,0.4), 0 0 80px rgba(230,57,70,.18)",
                            }}
                        >
                            FINAL TASK
                        </h1>
                        <button
                            id="btn-begin"
                            className={`${btnBase} px-10 py-[13px] text-[1.05rem] tracking-[0.14em]`}
                            onClick={handleBegin}
                        >
                            Play
                        </button>
                    </div>
                </div>
            )}



            {/* ── Jumpscare ────────────────────────────────────────────────────────── */}
            {phase === "scare" && (
                <div
                    className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black cursor-pointer ${scareVisible ? "animate-scare-flash" : ""}`}
                    onClick={handleScareClick}
                >
                    {scareVisible && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src="/scary_face.png"
                            alt=""
                            className="w-full h-full object-cover select-none pointer-events-none animate-scare-in"
                            draggable={false}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
