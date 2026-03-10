"use client";

import { useEffect, useState } from "react";

const CYCLE_WORDS = ["Events", "Design", "Content", "GLNP", "MANAGER"];
// Durations (ms) each word is shown before flipping to the next
const CYCLE_DELAYS = [260, 260, 280, 320];

export default function InductedPage() {
    const [step, setStep] = useState(0);

    // ── Word-cycling state ───────────────────────────────────────────────────
    const [wordIdx, setWordIdx] = useState(0);
    const [wordVisible, setWordVisible] = useState(false); // drives clip animation
    const [settled, setSettled] = useState(false);

    // Stagger each content block in
    useEffect(() => {
        const timers = [
            setTimeout(() => setStep(1), 120),
            setTimeout(() => setStep(2), 520),
            setTimeout(() => setStep(3), 900),
            setTimeout(() => setStep(4), 1260),
            setTimeout(() => setStep(5), 1600),
        ];
        return () => timers.forEach(clearTimeout);
    }, []);

    // ── Start the slot-machine once the membership line is visible (step 5) ──
    useEffect(() => {
        if (step < 5) return;

        let idx = 0;
        setWordIdx(0);
        setWordVisible(true);
        setSettled(false);

        const flip = () => {
            // fade out current word
            setWordVisible(false);

            setTimeout(() => {
                idx++;
                setWordIdx(idx);
                setWordVisible(true);

                if (idx < CYCLE_WORDS.length - 1) {
                    // schedule next flip
                    setTimeout(flip, CYCLE_DELAYS[idx] ?? 300);
                } else {
                    // landed on Coordinator — mark settled after a beat
                    setTimeout(() => setSettled(true), 350);
                }
            }, 120); // gap between out & in
        };

        // First word shown immediately, start flipping after initial delay
        const start = setTimeout(flip, CYCLE_DELAYS[0]);
        return () => clearTimeout(start);
    }, [step]);

    const fade = (threshold: number): React.CSSProperties => ({
        opacity: step >= threshold ? 1 : 0,
        transform: step >= threshold ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 0.55s ease, transform 0.55s ease",
    });

    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                background: "#f5f4f1",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'NeueMontreal', 'Helvetica Neue', Arial, sans-serif",
                padding: "0 24px",
                overflowY: "auto",
            }}
        >

            {/* Badge */}
            <div style={{ ...fade(2), marginBottom: 28 }}>
                <span
                    style={{
                        display: "inline-block",
                        fontSize: "0.68rem",
                        letterSpacing: "0.28em",
                        textTransform: "uppercase",
                        color: "#1a1a1a",
                        border: "1px solid #1a1a1a",
                        padding: "5px 16px",
                        fontFamily: "inherit",
                    }}
                >
                    Orientation &apos;26
                </span>
            </div>

            {/* Main heading */}
            <h1
                style={{
                    ...fade(3),
                    fontSize: "clamp(3rem, 10vw, 7.5rem)",
                    fontWeight: 400,
                    letterSpacing: "-0.01em",
                    lineHeight: 1.0,
                    color: "#0f0f0f",
                    textAlign: "center",
                    marginBottom: 32,
                    fontFamily: "inherit",
                }}
            >
                You&apos;re Inducted.
            </h1>

            {/* Sub copy */}
            <p
                style={{
                    ...fade(4),
                    fontSize: "clamp(0.78rem, 1.6vw, 0.96rem)",
                    color: "#555",
                    letterSpacing: "0.04em",
                    textAlign: "center",
                    maxWidth: 400,
                    lineHeight: 1.8,
                    marginBottom: 40,
                    fontFamily: "inherit",
                }}
            >
                Welcome to the family
                <br />
                <span className="text-red-900">A million memories awaits</span>
            </p>

            {/* ── Membership line with slot-machine role ── */}
            <div
                style={{
                    ...fade(5),
                    display: "flex",
                    alignItems: "center",
                    gap: "0.55em",
                    fontSize: "0.72rem",
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "#888",
                    fontFamily: "inherit",
                    userSelect: "none",
                }}
            >
                <span>OT &apos;26</span>
                <span style={{ opacity: 0.4 }}>·</span>

                {/* Cycling word — fades + nudges, no clip */}
                <span
                    style={{
                        display: "inline-block",
                        position: "relative",
                        minWidth: "8ch",
                        paddingBottom: 4, // room for the underline without affecting baseline
                    }}
                >
                    <span
                        style={{
                            display: "inline-block",
                            opacity: wordVisible ? 1 : 0,
                            transform: wordVisible ? "translateY(0)" : "translateY(-6px)",
                            transition: wordVisible
                                ? "opacity 0.15s ease, transform 0.18s cubic-bezier(.22,1,.36,1)"
                                : "opacity 0.1s ease, transform 0.1s ease",
                            color: settled ? "#0f0f0f" : "#888",
                            fontWeight: settled ? 700 : 400,
                            letterSpacing: settled ? "0.18em" : "0.22em",
                            whiteSpace: "nowrap",
                            ...(settled && {
                                transition: "color 0.4s ease, font-weight 0.3s ease, letter-spacing 0.3s ease, opacity 0.15s ease, transform 0.18s ease",
                            }),
                        }}
                    >
                        {CYCLE_WORDS[wordIdx]}
                    </span>
                    {/* Underline accent — absolutely positioned so it doesn't shift baseline */}
                    <span
                        style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            height: "1.5px",
                            width: settled ? "100%" : "0%",
                            background: "#0f0f0f",
                            transition: "width 0.5s cubic-bezier(.22,1,.36,1) 0.2s",
                            borderRadius: 1,
                        }}
                    />
                </span>
            </div>
        </div>
    );
}
