import React, { useState, useMemo, useEffect, useRef } from "react";

const MN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const MS = MN.map(m => m.slice(0, 3));

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateDisplay(val) {
  const d = parseDate(val);
  if (!d) return "—";
  const yr = String(d.getFullYear()).slice(-2);
  return `${d.getDate()} ${MS[d.getMonth()]} ${yr}`;
}

function getInitials(name) {
  if (!name) return "HR";
  const clean = name.trim().replace(/^admin\s*-\s*/i, "");
  return clean
    .split(/\s+/)
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "HR";
}

function AnimatedNumber({ value }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let start = displayValue;
    const end = Number(value) || 0;
    if (start === end) return;
    const duration = 500;
    const t0 = performance.now();
    let animId;

    const frame = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplayValue(Math.round(start + (end - start) * ease));
      if (p < 1) {
        animId = requestAnimationFrame(frame);
      }
    };
    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [value]);

  return <span>{displayValue}</span>;
}

export default function PerformanceDeck({ performanceData = {}, analytics = {}, hrAvatarMap = {} }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentQuarter = Math.floor(currentMonth / 3);

  const getHRAvatar = (nameOrEmail) => {
    if (!nameOrEmail || typeof nameOrEmail !== "string") return null;
    const clean = nameOrEmail.trim().toLowerCase();
    const map = (hrAvatarMap && Object.keys(hrAvatarMap).length > 0)
      ? hrAvatarMap
      : (performanceData.hrAvatarMap || {});
    if (map[clean]) return map[clean];
    const first = clean.split(" ")[0];
    if (map[first]) return map[first];
    const user = clean.split("@")[0];
    if (map[user]) return map[user];
    return null;
  };

  // States for each of the 3 cards: mode ('m' | 'q'), month (0..11), quarter (0..3), dropdown open
  const [cardsState, setCardsState] = useState([
    { mode: "m", m: currentMonth, q: currentQuarter, open: false },
    { mode: "m", m: currentMonth, q: currentQuarter, open: false },
    { mode: "m", m: currentMonth, q: currentQuarter, open: false }
  ]);

  const deckRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (deckRef.current && !deckRef.current.contains(e.target)) {
        setCardsState(prev => prev.map(s => ({ ...s, open: false })));
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // 1. DEDUPLICATED & PROCESSED CLIENTS
  const clients = useMemo(() => {
    const rawClients = performanceData.clients || [];
    const seen = new Set();
    const result = [];

    rawClients.forEach(c => {
      const name = (c.clientName || "").trim();
      const id = (c.clientId || "").trim();
      const dedupKey = (id || name).toLowerCase();
      if (!dedupKey || seen.has(dedupKey)) return;
      seen.add(dedupKey);

      const d = parseDate(c.createdOn);
      result.push({
        id: id || name,
        clientName: name || "Unnamed Client",
        details: c.businessUnit || c.industry || "General Corporate",
        createdBy: c.createdBy || "Admin",
        createdOn: c.createdOn,
        dateObj: d,
        month: d ? d.getMonth() : currentMonth,
        year: d ? d.getFullYear() : currentYear,
        day: d ? d.getDate() : 1
      });
    });

    return result;
  }, [performanceData.clients, currentMonth, currentYear]);

  // 2. DEDUPLICATED & PROCESSED CLIENT JOBS (JPCs)
  const clientJobs = useMemo(() => {
    const rawJobs = performanceData.clientJobs || [];
    const seen = new Set();
    const result = [];

    rawJobs.forEach(j => {
      const code = (j.jobCode || "").trim();
      const dedupKey = code.toLowerCase();
      if (!dedupKey || seen.has(dedupKey)) return;
      seen.add(dedupKey);

      const d = parseDate(j.createdOn);
      result.push({
        jobCode: code,
        jobTitle: j.jobTitle || "Job Requisition",
        clientName: j.clientName || "Client Requisition",
        createdBy: j.createdBy || "Admin",
        createdOn: j.createdOn,
        dateObj: d,
        month: d ? d.getMonth() : currentMonth,
        year: d ? d.getFullYear() : currentYear,
        day: d ? d.getDate() : 1
      });
    });

    return result;
  }, [performanceData.clientJobs, currentMonth, currentYear]);

  // 3. DEDUPLICATED & PROCESSED CLOSURES & RECRUITER LIST
  const { closures, hrEmployees } = useMemo(() => {
    const rawClosures = performanceData.closures || [];
    const seen = new Set();
    const closureList = [];

    rawClosures.forEach(c => {
      const id = (c.id || c.candidateName || "").toLowerCase().trim();
      if (id && seen.has(id)) return;
      if (id) seen.add(id);

      const d = parseDate(c.date);
      closureList.push({
        id: c.id,
        candidateName: c.candidateName || "Candidate",
        role: c.role || "Position",
        employee: (c.employee || "HR").trim(),
        status: c.status || "Hired",
        date: c.date,
        dateObj: d,
        month: d ? d.getMonth() : currentMonth,
        year: d ? d.getFullYear() : currentYear,
        day: d ? d.getDate() : 1
      });
    });

    // Collect all HR recruiter names
    const hrNamesSet = new Set();
    (performanceData.hrs || []).forEach(h => {
      if (h.hrName && h.hrName.trim()) hrNamesSet.add(h.hrName.trim());
    });
    (analytics.hrDailyStats || []).forEach(h => {
      if (h.hr && h.hr !== "Portal / Unknown") hrNamesSet.add(h.hr.trim());
    });
    closureList.forEach(c => {
      if (c.employee && c.employee !== "HR" && c.employee !== "Admin") {
        hrNamesSet.add(c.employee);
      }
    });

    const hrList = Array.from(hrNamesSet);
    if (hrList.length === 0) {
      hrList.push("Karanpreet Kaur", "Neha Srivastava", "Payal", "Preetima Gupta");
    }

    return {
      closures: closureList,
      hrEmployees: hrList
    };
  }, [performanceData.closures, performanceData.hrs, analytics.hrDailyStats, currentMonth, currentYear]);

  // Active months for a card state
  const getActiveMonths = (s) => (s.mode === "m" ? [s.m] : [s.q * 3, s.q * 3 + 1, s.q * 3 + 2]);

  // Check if a record falls in the given months and year
  const isRecordInMonths = (item, months) => {
    // If record has no valid date, we count it in the current month
    if (!item.dateObj) {
      return months.includes(currentMonth);
    }
    // Match year and month
    const yrMatch = item.year === currentYear;
    return yrMatch && months.includes(item.month);
  };

  // Compute total for card k (0: closures, 1: clients, 2: jpcs) in given months
  const computeTotal = (k, months) => {
    if (k === 0) {
      return closures.filter(c => isRecordInMonths(c, months)).length;
    }
    if (k === 1) {
      return clients.filter(c => isRecordInMonths(c, months)).length;
    }
    if (k === 2) {
      return clientJobs.filter(j => isRecordInMonths(j, months)).length;
    }
    return 0;
  };

  // Handlers
  const toggleDropdown = (k, e) => {
    e.stopPropagation();
    setCardsState(prev =>
      prev.map((s, idx) => (idx === k ? { ...s, open: !s.open } : { ...s, open: false }))
    );
  };

  const setCardMode = (k, mode) => {
    setCardsState(prev =>
      prev.map((s, idx) => {
        if (idx !== k) return s;
        return {
          ...s,
          mode,
          q: Math.floor(s.m / 3),
          open: false
        };
      })
    );
  };

  const selectPeriod = (k, value) => {
    setCardsState(prev =>
      prev.map((s, idx) => {
        if (idx !== k) return s;
        return {
          ...s,
          [s.mode]: value,
          open: false
        };
      })
    );
  };

  const handleBarClick = (k, monthIdx) => {
    setCardsState(prev =>
      prev.map((s, idx) => {
        if (idx !== k) return s;
        return {
          ...s,
          mode: "m",
          m: monthIdx,
          q: Math.floor(monthIdx / 3),
          open: false
        };
      })
    );
  };

  const CARDS_META = [
    {
      title: "Closures & Placements",
      subtitle: "Employee-wise breakdown",
      unit: "closures",
      header: ["Employee", "Closures"],
      icon: (
        <svg viewBox="0 0 24 24">
          <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
        </svg>
      )
    },
    {
      title: "New Clients Added",
      subtitle: "Corporate onboarding",
      unit: "clients",
      header: ["Client & details", "Added by · Date"],
      icon: (
        <svg viewBox="0 0 24 24">
          <path d="M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 10h3a1 1 0 0 1 1 1v10M3 21h18M9 8h2M9 12h2M9 16h2" />
        </svg>
      )
    },
    {
      title: "JPCs Created",
      subtitle: "Client job requisitions",
      unit: "JPCs",
      header: ["JPC & title", "Client · Added by"],
      icon: (
        <svg viewBox="0 0 24 24">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 10v5M9.5 12.5h5" />
        </svg>
      )
    }
  ];

  return (
    <section ref={deckRef} className="perf-deck-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        /* PURE IVORY THEME ONLY */
        .perf-deck-root {
          --ff: 'Plus Jakarta Sans', system-ui, sans-serif;
          --bg: #f4f1ec;
          --card: #ffffff;
          --bd: #ece7df;
          --txt: #14213d;
          --mut: #6b7280;
          --line: #eee9e1;
          --soft: #f8f6f2;
          --a1: #15803d;
          --a2: #2563eb;
          --a3: #ea580c;
          --sh: 0 18px 40px -18px rgba(20,33,61,.25);
          --r: 26px;
          --onc: #ffffff;
          font-family: var(--ff);
          background: var(--bg);
          color: var(--txt);
          border-radius: 28px;
          padding: 24px;
          margin-bottom: 36px;
          position: relative;
          box-shadow: 0 10px 30px -10px rgba(20,33,61,.08);
          border: 1px solid var(--bd);
        }

        .perf-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 20px;
          width: 100%;
        }

        .perf-card {
          position: relative;
          background: var(--card);
          border: 1px solid var(--bd);
          border-radius: var(--r);
          box-shadow: var(--sh);
          padding: 20px 20px 24px;
          min-height: 550px;
          display: flex;
          flex-direction: column;
          transition: transform .35s cubic-bezier(.2,.8,.2,1), box-shadow .35s;
          box-sizing: border-box;
          animation: perfRise .65s cubic-bezier(.2,.8,.2,1) both;
        }
        .perf-card.c1 { --c: var(--a1); animation-delay: .05s; }
        .perf-card.c2 { --c: var(--a2); animation-delay: .12s; }
        .perf-card.c3 { --c: var(--a3); animation-delay: .19s; }
        .perf-card:hover { transform: translateY(-5px); }

        @keyframes perfRise {
          from { opacity: 0; transform: translateY(16px) scale(.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .perf-card::before {
          content: "";
          position: absolute;
          inset: 0 0 auto;
          height: 100px;
          border-radius: var(--r) var(--r) 0 0;
          background: linear-gradient(180deg, color-mix(in srgb, var(--c) 12%, transparent), transparent);
          pointer-events: none;
        }

        .perf-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
        }
        .perf-header-left {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .perf-ico {
          width: 40px;
          height: 40px;
          border-radius: calc(var(--r) * .45);
          display: grid;
          place-items: center;
          background: color-mix(in srgb, var(--c) 15%, transparent);
          color: var(--c);
          transition: transform .4s ease;
          flex-shrink: 0;
        }
        .perf-card:hover .perf-ico {
          transform: rotate(-8deg) scale(1.06);
        }
        .perf-ico svg {
          width: 20px;
          height: 20px;
          stroke: currentColor;
          fill: none;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .perf-header h3 {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -.01em;
          margin: 0;
          color: var(--txt);
        }
        .perf-header p {
          font-size: 12px;
          color: var(--mut);
          margin: 2px 0 0;
        }

        .perf-ctl {
          display: flex;
          gap: 9px;
          align-items: center;
          margin-top: 14px;
          position: relative;
          z-index: 5;
        }
        .perf-seg {
          position: relative;
          display: flex;
          padding: 3.5px;
          border-radius: 99px;
          background: color-mix(in srgb, var(--txt) 7%, transparent);
          border: 1px solid var(--line);
        }
        .perf-seg button {
          position: relative;
          z-index: 1;
          border: 0;
          background: none;
          font: 600 11.5px var(--ff);
          color: var(--mut);
          padding: 6px 13px;
          cursor: pointer;
          transition: color .3s;
          border-radius: 99px;
        }
        .perf-seg[data-mode="m"] button:first-of-type,
        .perf-seg[data-mode="q"] button:last-of-type {
          color: var(--onc);
        }
        .perf-pill {
          position: absolute;
          top: 3.5px;
          bottom: 3.5px;
          left: 3.5px;
          width: calc(50% - 3.5px);
          border-radius: 99px;
          background: var(--c);
          box-shadow: 0 4px 12px -4px var(--c);
          transition: transform .45s cubic-bezier(.5, 1.4, .5, 1);
        }
        .perf-seg[data-mode="q"] .perf-pill {
          transform: translateX(100%);
        }

        .perf-dd {
          position: relative;
          flex: 1;
          min-width: 0;
        }
        .perf-ddb {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          font: 600 12px var(--ff);
          color: var(--txt);
          background: color-mix(in srgb, var(--txt) 5%, transparent);
          border: 1px solid var(--line);
          border-radius: 99px;
          padding: 8px 12px;
          cursor: pointer;
          transition: .25s;
        }
        .perf-ddb:hover,
        .perf-dd.open .perf-ddb {
          border-color: var(--c);
        }
        .perf-ddb svg {
          width: 14px;
          height: 14px;
          stroke: var(--c);
          fill: none;
          stroke-width: 2.2;
          transition: transform .3s;
        }
        .perf-dd.open .perf-ddb svg {
          transform: rotate(180deg);
        }

        .perf-ddm {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          max-height: 240px;
          overflow-y: auto;
          list-style: none;
          margin: 0;
          padding: 5px;
          border-radius: 16px;
          background: #ffffff;
          color: var(--txt);
          border: 1px solid var(--line);
          box-shadow: 0 20px 40px -10px rgba(20,33,61,.25);
          opacity: 0;
          transform: translateY(-6px) scale(.97);
          transform-origin: top;
          pointer-events: none;
          transition: .22s cubic-bezier(.2,.8,.2,1);
          z-index: 50;
        }
        .perf-dd.open .perf-ddm {
          opacity: 1;
          transform: none;
          pointer-events: auto;
        }
        .perf-ddm li {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 7px 11px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: .15s;
        }
        .perf-ddm li:hover {
          background: color-mix(in srgb, var(--c) 15%, transparent);
          padding-left: 14px;
        }
        .perf-ddm li.sel {
          background: var(--c);
          color: var(--onc);
          font-weight: 700;
        }
        .perf-ddm li b {
          font-size: 10.5px;
          opacity: .75;
        }

        .perf-hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 10px;
          margin-top: 14px;
          padding: 13px 15px;
          border-radius: calc(var(--r) * .6);
          background: color-mix(in srgb, var(--c) 8%, var(--soft));
          border: 1px solid color-mix(in srgb, var(--c) 25%, transparent);
        }
        .perf-hl {
          font-size: 11px;
          font-weight: 600;
          color: var(--c);
          letter-spacing: .02em;
        }
        .perf-num {
          font-size: 36px;
          font-weight: 700;
          line-height: 1.05;
          letter-spacing: -.02em;
          color: var(--txt);
        }
        .perf-num small {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--c);
          margin-left: 5px;
          letter-spacing: 0;
        }
        .perf-dl {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.01em;
          background: transparent;
          padding: 0;
          color: var(--mut);
        }
        .perf-dl.perf-up {
          background: transparent;
          color: #16a34a;
        }
        .perf-dl.perf-dn {
          background: transparent;
          color: #dc2626;
        }

        .perf-spark {
          display: flex;
          align-items: flex-end;
          gap: 3.5px;
          height: 46px;
        }
        .perf-spark i {
          display: block;
          width: 6px;
          min-height: 4px;
          border-radius: 3px;
          background: color-mix(in srgb, var(--c) 28%, transparent);
          cursor: pointer;
          transform-origin: bottom;
          transition: all .25s;
          animation: perfGrow .6s both;
        }
        .perf-spark i:hover {
          background: var(--c);
          transform: scaleY(1.12);
        }
        .perf-spark i.on {
          background: var(--c);
          box-shadow: 0 0 10px -2px var(--c);
        }
        @keyframes perfGrow {
          from { transform: scaleY(0); }
        }

        .perf-lh {
          display: flex;
          justify-content: space-between;
          margin: 16px 4px 6px;
          padding-bottom: 7px;
          border-bottom: 1px solid var(--line);
          font-size: 11px;
          font-weight: 700;
          color: var(--mut);
          letter-spacing: .05em;
          text-transform: uppercase;
        }
        .perf-list {
          flex: 1;
          overflow-y: auto;
          max-height: 255px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 2px 2px 4px;
          scrollbar-width: thin;
          scrollbar-color: var(--line) transparent;
        }
        .perf-row {
          position: relative;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 9px;
          padding: 9px 12px;
          border-radius: calc(var(--r) * .5);
          background: var(--soft);
          border: 1px solid var(--line);
          animation: perfFin .45s both;
          animation-delay: var(--d);
          transition: transform .25s, border-color .25s, box-shadow .25s;
          text-decoration: none;
          color: inherit;
        }
        @keyframes perfFin {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .perf-row::before {
          content: "";
          position: absolute;
          left: 0;
          top: 22%;
          bottom: 22%;
          width: 3px;
          border-radius: 3px;
          background: var(--c);
          transform: scaleY(0);
          transition: .25s;
        }
        .perf-row:hover {
          transform: translateX(4px);
          border-color: color-mix(in srgb, var(--c) 55%, transparent);
          box-shadow: 0 8px 20px -12px var(--c);
        }
        .perf-row:hover::before {
          transform: scaleY(1);
        }

        .perf-l {
          min-width: 0;
        }
        .perf-l b {
          display: block;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: var(--txt);
        }
        .perf-l span {
          font-size: 11px;
          color: var(--mut);
        }
        .perf-l em {
          font-style: normal;
          font-size: 11px;
          font-weight: 800;
          color: var(--c);
          display: block;
          margin-bottom: 2px;
        }

        .perf-r {
          text-align: right;
          min-width: 0;
          font-size: 11px;
          color: var(--mut);
          flex-shrink: 0;
        }
        .perf-r b {
          display: flex;
          gap: 5px;
          align-items: center;
          justify-content: flex-end;
          color: var(--txt);
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 2px;
        }

        .perf-av {
          flex: none;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 10px;
          font-weight: 800;
          color: var(--c);
          background: color-mix(in srgb, var(--c) 17%, transparent);
        }
        .perf-er {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .perf-er .perf-l {
          flex: none;
          width: 115px;
        }
        .perf-bt {
          flex: 1;
          height: 7px;
          border-radius: 7px;
          background: color-mix(in srgb, var(--txt) 8%, transparent);
          overflow: hidden;
        }
        .perf-bt i {
          display: block;
          height: 100%;
          border-radius: 7px;
          background: linear-gradient(90deg, color-mix(in srgb, var(--c) 60%, transparent), var(--c));
          transform-origin: left;
          animation: perfBar .8s cubic-bezier(.2,.8,.2,1) both;
        }
        @keyframes perfBar {
          from { transform: scaleX(0); }
        }
        .perf-cn {
          min-width: 28px;
          text-align: center;
          font-weight: 800;
          font-size: 13px;
          padding: 3px 7px;
          border-radius: 8px;
          background: color-mix(in srgb, var(--c) 14%, transparent);
          color: var(--c);
        }
        .perf-empty {
          margin: auto;
          text-align: center;
          color: var(--mut);
          font-size: 12px;
          padding: 26px 10px;
          animation: perfFin .5s both;
        }
        .perf-empty b {
          display: block;
          font-size: 14px;
          color: var(--txt);
          margin-bottom: 3px;
        }

        @media(prefers-reduced-motion:reduce){
          .perf-deck-root * { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* 3 Performance Cards Grid (Pure Ivory Design) */}
      <div className="perf-grid">
        {CARDS_META.map((cardMeta, k) => {
          const s = cardsState[k];
          const isQuarter = s.mode === "q";
          const activeMonths = getActiveMonths(s);
          const currentTotal = computeTotal(k, activeMonths);

          // Delta calculation vs previous period
          const step = isQuarter ? 3 : 1;
          const prevMonths = activeMonths.map(m => m - step);
          const hasPrevious = prevMonths[0] >= 0;
          const prevTotal = hasPrevious ? computeTotal(k, prevMonths) : 0;
          const delta = currentTotal - prevTotal;
          const prevLabel = isQuarter ? `Q${s.q}` : MS[s.m - 1];

          // Sparkline data across all 12 months for current year
          const monthlyTotals = MN.map((_, mIdx) => computeTotal(k, [mIdx]));
          const maxMonthly = Math.max(1, ...monthlyTotals);

          // Dropdown options with live count
          const shortYear = String(currentYear).slice(-2);
          const dropdownOptions = isQuarter
            ? [0, 1, 2, 3].map(i => ({
              id: i,
              label: `Q${i + 1} ${shortYear} · ${MS[i * 3]}–${MS[i * 3 + 2]}`,
              count: computeTotal(k, [i * 3, i * 3 + 1, i * 3 + 2])
            }))
            : MN.map((name, i) => ({
              id: i,
              label: `${MS[i]} ${shortYear}`,
              count: computeTotal(k, [i])
            }));

          return (
            <article key={cardMeta.title} className={`perf-card c${k + 1}`}>
              {/* Header */}
              <header className="perf-header">
                <div className="perf-header-left">
                  <div className="perf-ico">{cardMeta.icon}</div>
                  <div>
                    <h3>{cardMeta.title}</h3>
                    <p>{cardMeta.subtitle}</p>
                  </div>
                </div>
              </header>

              {/* Controls: Segmented Toggle + Dropdown */}
              <div className="perf-ctl">
                <div className="perf-seg" data-mode={s.mode}>
                  <i className="perf-pill"></i>
                  <button type="button" onClick={() => setCardMode(k, "m")}>
                    Month
                  </button>
                  <button type="button" onClick={() => setCardMode(k, "q")}>
                    Quarter
                  </button>
                </div>

                <div className={`perf-dd ${s.open ? "open" : ""}`}>
                  <button
                    type="button"
                    className="perf-ddb"
                    onClick={(e) => toggleDropdown(k, e)}
                  >
                    <span>{isQuarter ? `Q${s.q + 1} ${shortYear}` : `${MS[s.m]} ${shortYear}`}</span>
                    <svg viewBox="0 0 24 24">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  <ul className="perf-ddm">
                    {dropdownOptions.map(opt => (
                      <li
                        key={opt.id}
                        className={opt.id === (isQuarter ? s.q : s.m) ? "sel" : ""}
                        onClick={() => selectPeriod(k, opt.id)}
                      >
                        <span>{opt.label}</span>
                        <b>{opt.count}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Hero Metric Section */}
              <div className="perf-hero">
                <div>
                  <div className="perf-hl">
                    {isQuarter ? `Q${s.q + 1} ${shortYear}` : `${MS[s.m]} ${shortYear}`}
                  </div>
                  <div className="perf-num">
                    <AnimatedNumber value={currentTotal} />
                    <small>{cardMeta.unit}</small>
                  </div>
                  {hasPrevious && (
                    <span
                      className={`perf-dl ${delta > 0 ? "perf-up" : delta < 0 ? "perf-dn" : ""
                        }`}
                    >
                      {delta > 0
                        ? `▲ +${delta}`
                        : delta < 0
                          ? `▼ ${delta}`
                          : `● no change`}{" "}
                      vs {prevLabel}
                    </span>
                  )}
                </div>

                {/* 12-Month Sparkline Chart */}
                <div className="perf-spark" title="Click a month to view">
                  {monthlyTotals.map((tot, mIdx) => {
                    const isSelected = activeMonths.includes(mIdx);
                    const barHeight = Math.max(6, (tot / maxMonthly) * 100);
                    return (
                      <i
                        key={mIdx}
                        className={isSelected ? "on" : ""}
                        style={{
                          height: `${barHeight}%`,
                          animationDelay: `${mIdx * 25}ms`
                        }}
                        onClick={() => handleBarClick(k, mIdx)}
                      />
                    );
                  })}
                </div>
              </div>

              {/* List Header */}
              <div className="perf-lh">
                <span>{cardMeta.header[0]}</span>
                <span>{cardMeta.header[1]}</span>
              </div>

              {/* List Content */}
              <div className="perf-list">
                {/* 1. CLOSURES EMPLOYEE BREAKDOWN */}
                {k === 0 && (() => {
                  const empCounts = hrEmployees.map(hrName => {
                    const count = closures.filter(c => {
                      const cEmp = (c.employee || "").toLowerCase().trim();
                      const hrMatch = cEmp === hrName.toLowerCase().trim() ||
                        cEmp.includes(hrName.toLowerCase().trim()) ||
                        hrName.toLowerCase().trim().includes(cEmp);
                      return hrMatch && isRecordInMonths(c, activeMonths);
                    }).length;
                    return { name: hrName, count };
                  });

                  // Sort by closures count descending
                  empCounts.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
                  const maxEmpCount = Math.max(1, ...empCounts.map(x => x.count));

                  if (empCounts.length === 0 || currentTotal === 0 && empCounts.every(e => e.count === 0)) {
                    return (
                      <div className="perf-empty">
                        <b>No Closures Logged</b>
                        No candidates marked Hired / Closed in {isQuarter ? `Q${s.q + 1} ${shortYear}` : `${MS[s.m]} ${shortYear}`}.
                      </div>
                    );
                  }

                  return empCounts.map((emp, i) => {
                    const barWidth = (emp.count / maxEmpCount) * 100;
                    return (
                      <div
                        key={emp.name}
                        className="perf-row"
                        style={{ "--d": `${i * 50}ms` }}
                      >
                        <div className="perf-er">
                          {getHRAvatar(emp.name) ? (
                            <img
                              src={getHRAvatar(emp.name)}
                              alt={emp.name}
                              className="perf-av"
                              style={{ objectFit: "cover", border: "1px solid rgba(0,0,0,0.08)" }}
                            />
                          ) : (
                            <span className="perf-av">{getInitials(emp.name)}</span>
                          )}
                          <div className="perf-l">
                            <b>{emp.name}</b>
                          </div>
                          <div className="perf-bt">
                            <i style={{ width: `${barWidth}%` }}></i>
                          </div>
                          <span className="perf-cn">{emp.count}</span>
                        </div>
                      </div>
                    );
                  });
                })()}

                {/* 2. NEW CLIENTS ADDED */}
                {k === 1 && (() => {
                  const filteredClients = clients
                    .filter(c => isRecordInMonths(c, activeMonths))
                    .sort((a, b) => (b.dateObj || 0) - (a.dateObj || 0));

                  if (filteredClients.length === 0) {
                    return (
                      <div className="perf-empty">
                        <b>No New Clients</b>
                        No corporate clients onboarded in {isQuarter ? `Q${s.q + 1} ${shortYear}` : `${MS[s.m]} ${shortYear}`}.
                      </div>
                    );
                  }

                  return filteredClients.map((c, i) => (
                    <div
                      key={c.id || i}
                      className="perf-row"
                      style={{ "--d": `${i * 50}ms` }}
                    >
                      <div className="perf-l">
                        <b>{c.clientName}</b>
                        <span>{c.details}</span>
                      </div>
                      <div className="perf-r">
                        <b>
                          {getHRAvatar(c.createdBy) ? (
                            <img
                              src={getHRAvatar(c.createdBy)}
                              alt={c.createdBy}
                              className="perf-av"
                              style={{ objectFit: "cover", border: "1px solid rgba(0,0,0,0.08)" }}
                            />
                          ) : (
                            <span className="perf-av">{getInitials(c.createdBy)}</span>
                          )}
                          {c.createdBy.split(" ")[0]}
                        </b>
                        <span>{formatDateDisplay(c.createdOn)}</span>
                      </div>
                    </div>
                  ));
                })()}

                {/* 3. JPCS CREATED */}
                {k === 2 && (() => {
                  const filteredJobs = clientJobs
                    .filter(j => isRecordInMonths(j, activeMonths))
                    .sort((a, b) => (b.dateObj || 0) - (a.dateObj || 0));

                  if (filteredJobs.length === 0) {
                    return (
                      <div className="perf-empty">
                        <b>No JPCs Created</b>
                        No job requisitions created in {isQuarter ? `Q${s.q + 1} ${shortYear}` : `${MS[s.m]} ${shortYear}`}.
                      </div>
                    );
                  }

                  return filteredJobs.map((j, i) => (
                    <a
                      key={j.jobCode || i}
                      href={`/admin/client-jobs/${j.jobCode}`}
                      className="perf-row"
                      style={{ "--d": `${i * 50}ms` }}
                    >
                      <div className="perf-l">
                        <em>{j.jobCode}</em>
                        <b>{j.jobTitle}</b>
                      </div>
                      <div className="perf-r">
                        <b>{j.clientName}</b>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          {getHRAvatar(j.createdBy) && (
                            <img
                              src={getHRAvatar(j.createdBy)}
                              alt={j.createdBy}
                              style={{ width: "16px", height: "16px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                            />
                          )}
                          {j.createdBy.split(" ")[0]} · {formatDateDisplay(j.createdOn)}
                        </span>
                      </div>
                    </a>
                  ));
                })()}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
