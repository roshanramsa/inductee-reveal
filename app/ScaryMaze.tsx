"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────
type Rect = { x: number; y: number; w: number; h: number };
type Phase = "landing" | "countdown" | "playing" | "failed" | "scare" | "reunion";

interface LevelConfig {
    id: number;
    title: string;
    subtitle: string;
    pathColor: string;
    corridors: Rect[];
    ballStart: { x: number; y: number };
    exitCheckX: number;
}

const BALL_RADIUS = 18;       // visual draw radius
const COLLISION_RADIUS = 11;  // smaller hitbox — forgiving collisions
const CW = 800, CH = 600;

// ─── Level Definitions ────────────────────────────────────────────────────────
// Corridor widths/heights must be ≥ 2 × BALL_RADIUS (36 px) so the ball fits.
const LEVELS: LevelConfig[] = [
    // Level 1 — wide corridors (80 px)
    {
        id: 1, title: "LEVEL 1", subtitle: "INITIATION", pathColor: "#f0ede6",
        corridors: [
            { x: 0, y: 260, w: 210, h: 80 },  // entry run →
            { x: 170, y: 90, w: 80, h: 250 },  // up │
            { x: 170, y: 90, w: 430, h: 80 },  // right along top →
            { x: 520, y: 90, w: 80, h: 310 },  // down │
            { x: 520, y: 320, w: 280, h: 80 },  // exit run →
        ],
        ballStart: { x: 30, y: 300 }, exitCheckX: 782,
    },
    // Level 2 — tighter corridors (50 px)
    {
        id: 2, title: "LEVEL 2", subtitle: "ENTANGLEMENT", pathColor: "#e6ddd2",
        corridors: [
            { x: 0, y: 275, w: 110, h: 50 }, // entry →
            { x: 60, y: 60, w: 50, h: 265 }, // up │
            { x: 60, y: 60, w: 360, h: 50 }, // right along top →
            { x: 370, y: 60, w: 50, h: 240 }, // down mid │
            { x: 150, y: 250, w: 270, h: 50 }, // left ←
            { x: 150, y: 250, w: 50, h: 190 }, // down │
            { x: 150, y: 390, w: 460, h: 50 }, // right along bottom →
            { x: 560, y: 150, w: 50, h: 290 }, // up right │
            { x: 560, y: 150, w: 240, h: 50 }, // exit run →
        ],
        ballStart: { x: 30, y: 300 }, exitCheckX: 782,
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Circle-vs-AABB: true if the ball circle overlaps (is inside) any corridor rect. */
function inCorridor(cx: number, cy: number, c: Rect[], radius = COLLISION_RADIUS): boolean {
    return c.some((r) => {
        // Clamp circle centre to rect bounds, then check distance
        const nearX = Math.max(r.x, Math.min(r.x + r.w, cx));
        const nearY = Math.max(r.y, Math.min(r.y + r.h, cy));
        const dx = cx - nearX;
        const dy = cy - nearY;
        // Ball is "inside" corridor when its centre is within the rect shrunk by radius
        // i.e. the whole circle fits inside (no edge sticks out)
        return (
            cx >= r.x + radius &&
            cx <= r.x + r.w - radius &&
            cy >= r.y + radius &&
            cy <= r.y + r.h - radius
        );
    });
}

/** Returns true if we're on a touch-primary device */
function isTouchDevice(): boolean {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(pointer: coarse)").matches;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ScaryMaze() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const router = useRouter();

    const [phase, setPhase] = useState<Phase>("landing");
    const [currentLevel, setCurrentLevel] = useState(0);
    const [failCount, setFailCount] = useState(0);
    const [scareVisible, setScareVisible] = useState(false);
    const [countdown, setCountdown] = useState(3);
    const [isTouch, setIsTouch] = useState(false);
    const [skipAvailable, setSkipAvailable] = useState(false);
    const [skipCountdown, setSkipCountdown] = useState(5);
    const [reunionStep, setReunionStep] = useState(0);

    const phaseRef = useRef<Phase>("landing");
    const currentLevelRef = useRef(0);
    const ballPosRef = useRef({ x: 20, y: 302 });
    const animFrameRef = useRef(0);
    const rippleRef = useRef<{ x: number; y: number; r: number; alpha: number }[]>([]);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const punchImgRef = useRef<HTMLImageElement | null>(null);
    const monkeImgRef = useRef<HTMLImageElement | null>(null);
    // For touch tracking
    const lastTouchRef = useRef<{ x: number; y: number } | null>(null);

    phaseRef.current = phase;
    currentLevelRef.current = currentLevel;

    // Pre-load sprite images
    useEffect(() => {
        const punch = new Image();
        punch.src = "/punch.jpg";
        punchImgRef.current = punch;

        const monke = new Image();
        monke.src = "/monke.jpg";
        monkeImgRef.current = monke;
    }, []);

    // Detect touch on mount
    useEffect(() => {
        setIsTouch(isTouchDevice());
    }, []);

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

        // Exit marker — monke fills the tail of the last corridor, flush to its right edge
        const last = level.corridors[level.corridors.length - 1];
        const exitW = 80;
        const exitX = last.x + last.w - exitW; // flush against the right edge, no gap
        const exitH = last.h;
        const isLastLevel = currentLevelRef.current === LEVELS.length - 1;
        if (isLastLevel && monkeImgRef.current?.complete && monkeImgRef.current.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(exitX, last.y, exitW, exitH);
            ctx.clip();
            // stretch to fill the full exit area — no gap, no centering padding
            ctx.drawImage(monkeImgRef.current, exitX, last.y, exitW, exitH);
            ctx.restore();
        } else {
            // Plain marker on level 1 (or while monke is loading)
            ctx.fillStyle = "rgba(255,255,255,0.18)";
            ctx.fillRect(exitX, last.y, exitW, exitH);
            ctx.font = "bold 11px 'NeueMontreal', monospace";
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            ctx.fillText("EXIT", exitX + exitW / 2 - 12, last.y + exitH / 2 + 4);
        }

        // Level indicator
        ctx.font = "bold 12px 'NeueMontreal', monospace";
        ctx.fillStyle = level.id === 2 ? "#fff" : "#555";
        ctx.fillText(`LVL ${level.id} / 2`, 8, 18);

        // Ripples — grey
        rippleRef.current = rippleRef.current.filter((rp) => rp.alpha > 0.01);
        for (const rp of rippleRef.current) {
            ctx.beginPath();
            ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(200,200,200,${rp.alpha})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            rp.r += 2; rp.alpha -= 0.035;
        }

        // Ball — drawn at BALL_RADIUS (same as collision radius)
        const { x: bx, y: by } = ballPosRef.current;
        if (punchImgRef.current?.complete && punchImgRef.current.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(bx, by, BALL_RADIUS, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(punchImgRef.current, bx - BALL_RADIUS, by - BALL_RADIUS, BALL_RADIUS * 2, BALL_RADIUS * 2);
            ctx.restore();
        } else {
            ctx.beginPath();
            ctx.arc(bx, by, BALL_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = "#3b82f6";
            ctx.fill();
        }

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
                // Only request pointer lock on non-touch devices
                if (!isTouchDevice()) {
                    setTimeout(() => canvasRef.current?.requestPointerLock(), 60);
                }
            } else {
                setCountdown(n);
            }
        }, 1000);
    }, []);

    // ── Shared advance/fail logic ──────────────────────────────────────────────
    const handleMove = useCallback((dx: number, dy: number) => {
        if (phaseRef.current !== "playing") return;

        const level = LEVELS[currentLevelRef.current];
        const prev = ballPosRef.current;
        const nx = Math.max(0, Math.min(CW, prev.x + dx));
        const ny = Math.max(0, Math.min(CH, prev.y + dy));
        ballPosRef.current = { x: nx, y: ny };

        if (nx >= level.exitCheckX && inCorridor(nx, ny, level.corridors)) {
            if (currentLevelRef.current >= LEVELS.length - 1) {
                // Final level — exit lock and show jumpscare
                document.exitPointerLock?.();
                phaseRef.current = "scare";
                setPhase("scare");
                setTimeout(() => { setScareVisible(true); playScream(); }, 80);
            } else {
                // Seamless advance
                const nextIdx = currentLevelRef.current + 1;
                ballPosRef.current = { ...LEVELS[nextIdx].ballStart };
                currentLevelRef.current = nextIdx;
                setCurrentLevel(nextIdx);
            }
            return;
        }

        if (!inCorridor(nx, ny, level.corridors)) {
            for (let i = 0; i < 3; i++)
                rippleRef.current.push({ x: nx, y: ny, r: BALL_RADIUS + i * 4, alpha: 0.9 - i * 0.25 });
            document.exitPointerLock?.();
            phaseRef.current = "failed";
            setPhase("failed");
            setFailCount((c) => c + 1);
        }
    }, [playScream]);

    // ── Pointer lock mouse delta tracking (desktop) ────────────────────────────
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (phaseRef.current !== "playing") return;
            if (document.pointerLockElement !== canvasRef.current) return;
            handleMove(e.movementX, e.movementY);
        };

        document.addEventListener("mousemove", onMove);
        return () => document.removeEventListener("mousemove", onMove);
    }, [handleMove]);

    // Escape / external pointer-lock loss (desktop)
    useEffect(() => {
        const onLockChange = () => {
            if (document.pointerLockElement === null && phaseRef.current === "playing" && !isTouchDevice()) {
                phaseRef.current = "failed";
                setPhase("failed");
                setFailCount((c) => c + 1);
            }
        };
        document.addEventListener("pointerlockchange", onLockChange);
        return () => document.removeEventListener("pointerlockchange", onLockChange);
    }, []);

    // ── Touch controls (mobile) ────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const getScale = () => {
            // The canvas element is visually scaled via CSS max-w/max-h; we need
            // to convert touch pixel deltas to logical canvas pixel deltas.
            const rect = canvas.getBoundingClientRect();
            const scaleX = CW / rect.width;
            const scaleY = CH / rect.height;
            return { scaleX, scaleY };
        };

        const onTouchStart = (e: TouchEvent) => {
            e.preventDefault();
            if (phaseRef.current !== "playing") return;
            const t = e.touches[0];
            lastTouchRef.current = { x: t.clientX, y: t.clientY };
        };

        const onTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            if (phaseRef.current !== "playing") return;
            const t = e.touches[0];
            if (!lastTouchRef.current) {
                lastTouchRef.current = { x: t.clientX, y: t.clientY };
                return;
            }
            const { scaleX, scaleY } = getScale();
            const dx = (t.clientX - lastTouchRef.current.x) * scaleX;
            const dy = (t.clientY - lastTouchRef.current.y) * scaleY;
            lastTouchRef.current = { x: t.clientX, y: t.clientY };
            handleMove(dx, dy);
        };

        const onTouchEnd = () => {
            lastTouchRef.current = null;
        };

        canvas.addEventListener("touchstart", onTouchStart, { passive: false });
        canvas.addEventListener("touchmove", onTouchMove, { passive: false });
        canvas.addEventListener("touchend", onTouchEnd);

        return () => {
            canvas.removeEventListener("touchstart", onTouchStart);
            canvas.removeEventListener("touchmove", onTouchMove);
            canvas.removeEventListener("touchend", onTouchEnd);
        };
    }, [handleMove]);

    const handleBegin = () => { ensureAudio(); startLevel(0); };
    // Failure always resets to level 1
    const handleRetry = () => { ensureAudio(); startLevel(0); };
    // Skip-ad timer — starts when the scare phase begins
    useEffect(() => {
        if (phase !== "scare") {
            setSkipAvailable(false);
            setSkipCountdown(5);
            return;
        }
        let n = 5;
        setSkipCountdown(n);
        const tick = setInterval(() => {
            n--;
            if (n <= 0) {
                clearInterval(tick);
                setSkipAvailable(true);
            } else {
                setSkipCountdown(n);
            }
        }, 1000);
        return () => clearInterval(tick);
    }, [phase]);

    const handleSkip = () => {
        setPhase("reunion");
        phaseRef.current = "reunion";
    };

    // ── Reunion animation + auto-route ────────────────────────────────────────
    useEffect(() => {
        if (phase !== "reunion") { setReunionStep(0); return; }
        const timers = [
            setTimeout(() => setReunionStep(1), 100),   // punch slides in
            setTimeout(() => setReunionStep(2), 600),   // monke slides in
            setTimeout(() => setReunionStep(3), 1300),  // caption fades in
            setTimeout(() => router.push("/inducted"), 3800), // navigate
        ];
        return () => timers.forEach(clearTimeout);
    }, [phase, router]);

    const showCanvas = ["countdown", "playing", "failed"].includes(phase);
    const lvl = LEVELS[currentLevel];

    // ── Shared class strings ────────────────────────────────────────────────────
    const overlayBase = "absolute inset-0 flex items-center justify-center rounded z-20";
    const btnBase =
        "border border-white bg-transparent text-white font-bold " +
        "tracking-[0.1em] cursor-pointer transition-all duration-200 " +
        "hover:bg-white hover:text-black active:bg-white active:text-black";

    return (
        /* Root */
        <div
            className="w-screen h-screen flex flex-col items-center justify-center antialiased overflow-hidden"
            style={{ background: "#0a0a0a" }}
        >
            {/* ── Canvas area ─────────────────────────────────────────────────────── */}
            <div className="relative flex-shrink-0" style={{ display: showCanvas ? "block" : "none" }}>
                <canvas
                    ref={canvasRef}
                    width={CW}
                    height={CH}
                    className="block border-2 border-[#1e1e1e] rounded-[6px] cursor-none"
                    style={{
                        boxShadow: "none",
                        // On mobile fill 98vw; on desktop constrain by both axes
                        maxWidth: "min(98vw, calc(88vh * 800 / 600))",
                        width: "100%",
                        height: "auto",
                        touchAction: "none",
                    }}
                />

                {/* Mobile drag hint — shown while playing */}
                {phase === "playing" && isTouch && (
                    <div
                        className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[0.6rem] tracking-[0.14em] text-[#555] pointer-events-none select-none"
                    >
                        DRAG TO MOVE BALL
                    </div>
                )}

                {/* Countdown overlay */}
                {phase === "countdown" && (
                    <div className={`${overlayBase} bg-[rgba(10,10,10,0.88)] backdrop-blur-md animate-fade-in`}>
                        <div className="flex flex-col items-center gap-3 text-center">
                            <p className="text-[0.72rem] tracking-[0.22em] text-[#666] uppercase">
                                {lvl.title} — {lvl.subtitle}
                            </p>
                            <div
                                className="font-black leading-none text-white animate-countdown-pop"
                                style={{ fontSize: "clamp(5rem,18vw,9rem)" }}
                            >
                                {countdown}
                            </div>
                            <p className="text-[0.78rem] text-[#666] tracking-[0.06em]">
                                {isTouch ? "Drag your finger to move the ball…" : "Centre your cursor, then get ready…"}
                            </p>
                        </div>
                    </div>
                )}

                {/* Failed overlay */}
                {phase === "failed" && (
                    <div className={`${overlayBase} bg-[rgba(10,10,10,0.92)] backdrop-blur-[4px] animate-fade-in`}>
                        <div className="flex flex-col items-center gap-[14px] text-center px-6 py-7 sm:px-12 sm:py-9">
                            <span className="text-[42px] animate-shake">✕</span>
                            <h2
                                className="font-extrabold tracking-[0.1em] text-white"
                                style={{ fontSize: "clamp(1.1rem,3vw,1.6rem)" }}
                            >
                                WALL CONTACT
                            </h2>
                            <span className="text-[0.7rem] text-[#666] tracking-[0.14em] border border-[#333] px-3 py-[3px]">
                                Failed on {lvl.title} — Back to Level 1
                            </span>
                            <p className="text-[0.82rem] text-[#555] tracking-[0.04em]">
                                {failCount < 3
                                    ? "Steady your hand."
                                    : failCount < 8
                                        ? `${failCount} total failures. Don't rush.`
                                        : `${failCount} total failures. Embarrassing.`}
                            </p>
                            <button id="btn-retry" className={`${btnBase} px-7 py-[10px] text-[0.88rem]`} onClick={handleRetry}>
                                Start Over
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Landing screen ───────────────────────────────────────────────────── */}
            {phase === "landing" && (
                <div className="flex items-center justify-center w-full h-full animate-fade-in">
                    <div className="flex flex-col items-center gap-8 sm:gap-10 text-center px-4">
                        <h1
                            className="font-black text-white tracking-[0.03em] uppercase animate-pulse-glow"
                            style={{ fontSize: "clamp(2.4rem,10vw,6rem)" }}
                        >
                            FINAL TASK
                        </h1>

                        {/* Task description */}
                        <div className="flex flex-col items-center gap-4">
                            {/* Portrait pair */}
                            <div className="flex items-center gap-3">
                                <div style={{
                                    width: 52, height: 52, borderRadius: "50%",
                                    overflow: "hidden", border: "2px solid #2a2a2a", flexShrink: 0,
                                }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="/punch.jpg" alt="Punch" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                </div>
                                <span style={{ fontSize: 20, userSelect: "none" }}>🤍</span>
                                <div style={{
                                    width: 52, height: 52, borderRadius: "50%",
                                    overflow: "hidden", border: "2px solid #2a2a2a", flexShrink: 0,
                                }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="/monke.jpg" alt="Plushie" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                </div>
                            </div>
                            <p className="text-[0.72rem] tracking-[0.2em] text-[#555] uppercase">
                                Reunite Punch with his plushie
                            </p>
                        </div>

                        {isTouch && (
                            <p className="text-[0.72rem] tracking-[0.18em] text-[#555] uppercase max-w-[260px]">
                                Drag your finger to guide the ball through the maze
                            </p>
                        )}
                        <button
                            id="btn-begin"
                            className={`${btnBase} px-8 py-[13px] sm:px-10 text-[1rem] tracking-[0.14em]`}
                            onClick={handleBegin}
                        >
                            Play
                        </button>
                    </div>
                </div>
            )}

            {/* ── Rick Roll ────────────────────────────────────────────────────────── */}
            {phase === "scare" && (
                <div
                    className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black ${scareVisible ? "animate-scare-flash" : ""}`}
                >
                    {scareVisible && (
                        <>
                            <video
                                src="/rick.mp4"
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover select-none pointer-events-none animate-scare-in"
                            />

                            {/* ── YouTube-style skip button ── */}
                            <div className="fixed bottom-8 right-6 z-[10000] flex flex-col items-end gap-2">
                                {!skipAvailable ? (
                                    /* Countdown chip */
                                    <div
                                        className="flex items-center gap-2 font-mono text-[0.78rem] tracking-[0.1em]"
                                        style={{
                                            background: "rgba(0,0,0,0.72)",
                                            border: "1px solid rgba(255,255,255,0.12)",
                                            color: "#aaa",
                                            padding: "10px 18px",
                                            backdropFilter: "blur(6px)",
                                        }}
                                    >
                                        <span>Skip in</span>
                                        <span style={{ color: "#fff", fontWeight: 700, minWidth: "1ch", textAlign: "center" }}>
                                            {skipCountdown}
                                        </span>
                                    </div>
                                ) : (
                                    /* Skip button */
                                    <button
                                        id="btn-skip-ad"
                                        onClick={handleSkip}
                                        className="flex items-center gap-2 font-mono font-bold tracking-[0.1em] cursor-pointer transition-all duration-150"
                                        style={{
                                            background: "rgba(0,0,0,0.82)",
                                            border: "1px solid rgba(255,255,255,0.22)",
                                            color: "#fff",
                                            padding: "10px 18px",
                                            fontSize: "0.82rem",
                                            backdropFilter: "blur(6px)",
                                            animation: "fadeIn .3s ease",
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(230,57,70,0.85)")}
                                        onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,0,0,0.82)")}
                                    >
                                        Skip Ad
                                        {/* Right-arrow chevron */}
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M8 5l8 7-8 7V5z" />
                                            <rect x="18" y="5" width="3" height="14" rx="1" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Reunion screen ───────────────────────────────────────────────────── */}
            {phase === "reunion" && (
                <div
                    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
                    style={{ background: "#0a0a0a" }}
                >
                    {/* Images row */}
                    <div className="flex items-center justify-center gap-0 w-full" style={{ maxWidth: 520 }}>
                        {/* Punch — slides in from left */}
                        <div
                            style={{
                                width: 180, height: 180,
                                borderRadius: "50%",
                                overflow: "hidden",
                                border: "3px solid #2a2a2a",
                                flexShrink: 0,
                                opacity: reunionStep >= 1 ? 1 : 0,
                                transform: reunionStep >= 1
                                    ? (reunionStep >= 2 ? "translateX(40px)" : "translateX(-120px)")
                                    : "translateX(-220px)",
                                transition: reunionStep === 1
                                    ? "transform 0.5s cubic-bezier(.22,1,.36,1), opacity 0.4s ease"
                                    : "transform 0.55s cubic-bezier(.22,1,.36,1)",
                            }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/punch.jpg" alt="Punch" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>

                        {/* Heart */}
                        <div
                            style={{
                                fontSize: 36,
                                zIndex: 2,
                                opacity: reunionStep >= 2 ? 1 : 0,
                                transform: reunionStep >= 2 ? "scale(1)" : "scale(0.2)",
                                transition: "opacity 0.4s ease 0.15s, transform 0.5s cubic-bezier(.34,1.56,.64,1) 0.15s",
                                userSelect: "none",
                                flexShrink: 0,
                            }}
                        >
                            🤍
                        </div>

                        {/* Monke — slides in from right */}
                        <div
                            style={{
                                width: 180, height: 180,
                                borderRadius: "50%",
                                overflow: "hidden",
                                border: "3px solid #2a2a2a",
                                flexShrink: 0,
                                opacity: reunionStep >= 2 ? 1 : 0,
                                transform: reunionStep >= 2 ? "translateX(-40px)" : "translateX(220px)",
                                transition: "transform 0.55s cubic-bezier(.22,1,.36,1), opacity 0.4s ease",
                            }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/monke.jpg" alt="Monke" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                    </div>

                    {/* Caption */}
                    <div
                        style={{
                            marginTop: 44,
                            opacity: reunionStep >= 3 ? 1 : 0,
                            transform: reunionStep >= 3 ? "translateY(0)" : "translateY(12px)",
                            transition: "opacity 0.6s ease, transform 0.6s ease",
                            textAlign: "center",
                        }}
                    >
                        <p
                            style={{
                                fontFamily: "'NeueMontreal', 'Helvetica Neue', Arial, sans-serif",
                                fontSize: "clamp(1rem,3vw,1.4rem)",
                                fontWeight: 600,
                                color: "#fff",
                                letterSpacing: "0.04em",
                                marginBottom: 8,
                            }}
                        >
                            Punch is reunited with his plushie.
                        </p>
                        <p
                            style={{
                                fontFamily: "'NeueMontreal', 'Helvetica Neue', Arial, sans-serif",
                                fontSize: "0.72rem",
                                color: "#444",
                                letterSpacing: "0.18em",
                                textTransform: "uppercase",
                            }}
                        >
                            Proceeding to induction…
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
