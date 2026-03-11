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
            setTimeout(() => setStep(6), 1940),
        ];
        return () => timers.forEach(clearTimeout);
    }, []);

    // ── Start the slot-machine once the membership line is visible ──
    useEffect(() => {
        if (step < 6) return;

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

    // ── Mobile detection ─────────────────────────────────────────────────────
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

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
                justifyContent: "flex-start",
                fontFamily: "'NeueMontreal', 'Helvetica Neue', Arial, sans-serif",
                padding: isMobile ? "48px 20px 64px" : "64px 24px 72px",
                overflowY: "auto",
                boxSizing: "border-box",
            }}
        >

            {/* Badge */}
            <div style={{ ...fade(2), marginBottom: 20 }}>
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
                    fontSize: isMobile
                        ? "clamp(2.4rem, 13vw, 3.8rem)"
                        : "clamp(3rem, 10vw, 7.5rem)",
                    fontWeight: 400,
                    letterSpacing: "-0.01em",
                    lineHeight: 1.05,
                    color: "#0f0f0f",
                    textAlign: "center",
                    marginBottom: 20,
                    fontFamily: "inherit",
                }}
            >
                You&apos;re Inducted.
            </h1>

            {/* Sub copy */}
            <p
                style={{
                    ...fade(4),
                    fontSize: isMobile ? "0.82rem" : "clamp(0.78rem, 1.6vw, 0.96rem)",
                    color: "#555",
                    letterSpacing: "0.04em",
                    textAlign: "center",
                    maxWidth: 360,
                    lineHeight: 1.8,
                    marginBottom: 28,
                    fontFamily: "inherit",
                }}
            >
                Welcome to the family
                <br />
                <span className="text-red-900">A million memories awaits</span>
            </p>

            <a
                href="https://chat.whatsapp.com/Fzkl9zymWa3EmsDUNM56by"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                    ...fade(4),
                    display: "inline-block",
                    marginBottom: 32,
                    fontSize: "0.72rem",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: "#1a1a1a",
                    border: "1px solid #1a1a1a",
                    padding: "8px 20px",
                    fontFamily: "inherit",
                    textDecoration: "none",
                    transition: "background 0.2s ease, color 0.2s ease, opacity 0.55s ease, transform 0.55s ease",
                }}
                onMouseEnter={e => {
                    (e.currentTarget as HTMLAnchorElement).style.background = "#1a1a1a";
                    (e.currentTarget as HTMLAnchorElement).style.color = "#f5f4f1";
                }}
                onMouseLeave={e => {
                    (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                    (e.currentTarget as HTMLAnchorElement).style.color = "#1a1a1a";
                }}
            >
                Join the community
            </a>

            {/* Design team blurb */}
            <div
                style={{
                    ...fade(5),
                    width: "100%",
                    maxWidth: 440,
                    marginBottom: 32,
                    padding: isMobile ? "16px 18px" : "20px 24px",
                    border: "1px solid #e0deda",
                    background: "#fff",
                    borderRadius: 2,
                    boxSizing: "border-box",
                }}
            >
                <p
                    style={{
                        margin: 0,
                        fontSize: "0.72rem",
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        color: "#aaa",
                        fontFamily: "inherit",
                        marginBottom: 10,
                    }}
                >
                    Your team
                </p>
                <p
                    style={{
                        margin: "0 0 16px",
                        fontSize: "1.05rem",
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#0f0f0f",
                        fontFamily: "inherit",
                    }}
                >
                    Content
                </p>

                {[
                    "Congratulations. Against all statistical probability and several deeply questionable decisions by the selection committee (mostly me), you have successfully survived the induction process and are now officially part of the Orientation '26 Content Team.",
                    "Take a moment. Breathe it in. Feel proud.",
                    "You're now part of the team responsible for shaping a lot of what the incoming batch will see and read during Orientation: the ideas, the words, the tone, the vibe of it all. Which sounds very serious and professional, but in reality will also involve late-night brainstorming, mildly chaotic Google Docs, and confidently naming files things like \u201cfinal_FINAL_v7_this_one_for_sure.\u201d",
                    "For Orientation, we're basically the people who make sure things sound cool, look cool, and don't read like they were written by a government circular from 1983. So over the next few weeks there'll be brainstorming, writing, editing, last-minute creativity, and the occasional moment where we all stare at a blank document hoping inspiration strikes.",
                    "But jokes aside, I'm genuinely really excited to work with all of you. We picked a great bunch, and I'm looking forward to the ideas, the chaos, and whatever slightly unhinged but brilliant stuff we end up creating together.",
                    "Welcome to the team. Let the chaos begin.",
                ].map((para, i) => (
                    <p
                        key={i}
                        style={{
                            margin: "0 0 12px",
                            fontSize: "0.84rem",
                            color: "#555",
                            lineHeight: 1.8,
                            fontFamily: "inherit",
                            letterSpacing: "0.01em",
                        }}
                    >
                        {para}
                    </p>
                ))}
            </div>

            {/* ── Membership line with slot-machine role ── */}
            <div
                style={{
                    ...fade(6),
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
