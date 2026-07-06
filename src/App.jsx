import React, { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Constants ──────────────────────────────────────────────────────────────
const RACE_DAY = new Date("2026-09-11T00:00:00");
const RUNNERS = ["Runner 1", "Runner 2", "Runner 3", "Runner 4"];
const accent = "#c0392b";
const dark = "#0d0d1a";

// ── Storage ────────────────────────────────────────────────────────────────
async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
async function load(key) {
  try {
    const user = await getUser();
    if (!user) return null;
    const { data } = await supabase.from("app_storage").select("value").eq("user_id", user.id).eq("key", key).limit(1);
    return data && data.length > 0 ? JSON.parse(data[0].value) : null;
  } catch { return null; }
}
async function save(key, val) {
  try {
    const user = await getUser();
    if (!user) { console.error("save: no user"); return; }
    const { error } = await supabase.from("app_storage").upsert({ user_id: user.id, key, value: JSON.stringify(val) }, { onConflict: "user_id,key" });
    if (error) console.error("save error:", key, error);
  } catch(e) { console.error("save exception:", key, e); }
}

// ── Date utilities ─────────────────────────────────────────────────────────
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function fmt(s) { if (!s || isNaN(s)) return "--"; const m = Math.floor(s/60), sc = Math.round(s%60); return `${m}:${sc.toString().padStart(2,"0")}`; }
function toSecs(m, s) { return Number(m)*60 + Number(s); }
function fmtPace(s, plus=0) { return fmt(s) + (plus ? "–"+fmt(s+plus) : "") + "/mi"; }
function daysToRace() { const t = new Date(); t.setHours(0,0,0,0); return Math.ceil((RACE_DAY-t)/86400000); }
function dateDiffDays(a, b) { return Math.round((b-a)/86400000); }
function formatDate(date) { return date.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" }); }
function project10Mile(rpr) {
  if (!rpr) return "--";
  const t = rpr*2.5*Math.pow(10/2.5,1.06);
  const h=Math.floor(t/3600), m=Math.floor((t%3600)/60), s=Math.round(t%60);
  return h>0?`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${m}:${String(s).padStart(2,"0")}`;
}
function calcPaces(goalSecs) {
  const rp = goalSecs/2.5;
  return { racePace:fmtPace(rp), tempo:fmtPace(rp*0.975,8), easy:fmtPace(rp*1.22,20), long:fmtPace(rp*1.28,20), racePaceRaw:rp, goalSecs };
}
function calcFromMile(mileSecs) { const rp=mileSecs*1.055, gs=rp*2.5; return { ...calcPaces(gs), estimatedGoal:fmt(gs) }; }
function calcFromAvgPace(paceSecs) { return calcPaces(paceSecs*2.5); }

// ── Schedule builder ───────────────────────────────────────────────────────
function buildSchedule(daysPerWeek, startDate) {
  const dayMaps = { 3:[2,4,6], 4:[1,3,5,6], 5:[1,2,3,5,6] };
  const targetDays = dayMaps[daysPerWeek] || dayMaps[4];
  const schedule = [];
  let cursor = new Date(startDate); cursor.setHours(0,0,0,0);
  while (schedule.length < 45) {
    if (cursor >= RACE_DAY) break;
    if (targetDays.includes(cursor.getDay())) schedule.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  schedule.push(new Date(RACE_DAY));
  return schedule;
}

// ── Avatar data ────────────────────────────────────────────────────────────
const SKIN_TONES = ["#FDDBB4","#F5C89A","#E8A87C","#C68642","#8D5524","#4A2912"];
const JERSEY_COLORS = ["#c0392b","#2980b9","#27ae60","#8e44ad","#e67e22","#1abc9c","#2c3e50","#f39c12","#e91e63","#00bcd4"];
const SHORTS_COLORS = ["#2c3e50","#ffffff","#c0392b","#2980b9","#27ae60","#8e44ad","#e67e22","#f39c12","#333","#e91e63"];

// SVG avatar poses — 8 illustrated runners
function RunnerSVG({ pose=0, skin="#E8A87C", jersey="#c0392b", shorts="#2c3e50", size=60 }) {
  const poses = [
    // Pose 0: mid-stride left
    <g key={0}>
      <ellipse cx="30" cy="12" rx="8" ry="9" fill={skin}/>
      <rect x="20" y="22" width="20" height="18" rx="4" fill={jersey}/>
      <rect x="22" y="40" width="7" height="14" rx="3" fill={shorts}/>
      <rect x="31" y="40" width="7" height="14" rx="3" fill={shorts}/>
      <rect x="22" y="53" width="9" height="5" rx="2" fill="#333"/>
      <rect x="31" y="53" width="9" height="5" rx="2" fill="#333"/>
      <line x1="20" y1="28" x2="10" y2="38" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
      <line x1="40" y1="28" x2="48" y2="36" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
    </g>,
    // Pose 1: sprinting
    <g key={1}>
      <ellipse cx="30" cy="11" rx="8" ry="9" fill={skin}/>
      <rect x="20" y="21" width="20" height="17" rx="4" fill={jersey}/>
      <rect x="21" y="38" width="7" height="16" rx="3" fill={shorts} transform="rotate(-15,24,46)"/>
      <rect x="31" y="38" width="7" height="16" rx="3" fill={shorts} transform="rotate(10,34,46)"/>
      <rect x="18" y="52" width="10" height="5" rx="2" fill="#333" transform="rotate(-15,23,54)"/>
      <rect x="32" y="52" width="10" height="5" rx="2" fill="#333" transform="rotate(10,37,54)"/>
      <line x1="20" y1="27" x2="8" y2="34" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
      <line x1="40" y1="27" x2="50" y2="20" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
    </g>,
    // Pose 2: upright runner
    <g key={2}>
      <ellipse cx="30" cy="12" rx="8" ry="9" fill={skin}/>
      <rect x="21" y="22" width="18" height="18" rx="4" fill={jersey}/>
      <rect x="22" y="40" width="7" height="15" rx="3" fill={shorts}/>
      <rect x="31" y="40" width="7" height="15" rx="3" fill={shorts}/>
      <rect x="21" y="54" width="9" height="5" rx="2" fill="#333"/>
      <rect x="30" y="54" width="9" height="5" rx="2" fill="#333"/>
      <line x1="21" y1="28" x2="12" y2="36" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
      <line x1="39" y1="28" x2="48" y2="36" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
    </g>,
    // Pose 3: leaning forward
    <g key={3}>
      <ellipse cx="32" cy="11" rx="8" ry="9" fill={skin} transform="rotate(15,32,11)"/>
      <rect x="22" y="21" width="20" height="17" rx="4" fill={jersey} transform="rotate(10,32,29)"/>
      <rect x="22" y="38" width="7" height="15" rx="3" fill={shorts}/>
      <rect x="31" y="40" width="7" height="15" rx="3" fill={shorts}/>
      <rect x="20" y="52" width="10" height="5" rx="2" fill="#333"/>
      <rect x="31" y="53" width="10" height="5" rx="2" fill="#333"/>
      <line x1="22" y1="26" x2="10" y2="30" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
      <line x1="40" y1="24" x2="50" y2="30" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
    </g>,
    // Pose 4: arms up celebrating
    <g key={4}>
      <ellipse cx="30" cy="12" rx="8" ry="9" fill={skin}/>
      <rect x="21" y="22" width="18" height="18" rx="4" fill={jersey}/>
      <rect x="22" y="40" width="7" height="14" rx="3" fill={shorts}/>
      <rect x="31" y="40" width="7" height="14" rx="3" fill={shorts}/>
      <rect x="22" y="53" width="9" height="5" rx="2" fill="#333"/>
      <rect x="31" y="53" width="9" height="5" rx="2" fill="#333"/>
      <line x1="21" y1="26" x2="10" y2="14" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
      <line x1="39" y1="26" x2="50" y2="14" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
    </g>,
    // Pose 5: stride right
    <g key={5}>
      <ellipse cx="30" cy="12" rx="8" ry="9" fill={skin}/>
      <rect x="20" y="22" width="20" height="18" rx="4" fill={jersey}/>
      <rect x="21" y="40" width="7" height="14" rx="3" fill={shorts} transform="rotate(10,24,47)"/>
      <rect x="32" y="40" width="7" height="14" rx="3" fill={shorts} transform="rotate(-10,36,47)"/>
      <rect x="19" y="52" width="10" height="5" rx="2" fill="#333" transform="rotate(10,24,54)"/>
      <rect x="31" y="52" width="10" height="5" rx="2" fill="#333" transform="rotate(-10,36,54)"/>
      <line x1="20" y1="28" x2="12" y2="36" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
      <line x1="40" y1="28" x2="50" y2="38" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
    </g>,
    // Pose 6: relaxed jog
    <g key={6}>
      <ellipse cx="30" cy="13" rx="8" ry="9" fill={skin}/>
      <rect x="21" y="23" width="18" height="16" rx="4" fill={jersey}/>
      <rect x="22" y="39" width="7" height="15" rx="3" fill={shorts}/>
      <rect x="31" y="39" width="7" height="15" rx="3" fill={shorts}/>
      <rect x="22" y="53" width="9" height="5" rx="2" fill="#333"/>
      <rect x="31" y="53" width="9" height="5" rx="2" fill="#333"/>
      <line x1="21" y1="29" x2="14" y2="38" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
      <line x1="39" y1="29" x2="46" y2="38" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
    </g>,
    // Pose 7: race finish lean
    <g key={7}>
      <ellipse cx="31" cy="11" rx="8" ry="9" fill={skin} transform="rotate(8,31,11)"/>
      <rect x="21" y="21" width="20" height="17" rx="4" fill={jersey} transform="rotate(8,31,29)"/>
      <rect x="22" y="38" width="7" height="16" rx="3" fill={shorts} transform="rotate(-5,25,46)"/>
      <rect x="31" y="38" width="7" height="16" rx="3" fill={shorts} transform="rotate(15,34,46)"/>
      <rect x="20" y="52" width="10" height="5" rx="2" fill="#333"/>
      <rect x="32" y="51" width="10" height="5" rx="2" fill="#333" transform="rotate(15,37,53)"/>
      <line x1="21" y1="26" x2="9" y2="20" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
      <line x1="40" y1="25" x2="50" y2="32" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
    </g>,
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="30" r="29" fill="#f0f0f0" stroke="#e0e0e0" strokeWidth="1"/>
      {poses[pose % poses.length]}
    </svg>
  );
}

function Avatar({ config, size=40 }) {
  if (!config) return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:"#e0e0e0",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size*0.4, color:"#aaa" }}>?</div>
  );
  return <RunnerSVG pose={config.pose} skin={config.skin} jersey={config.jersey} shorts={config.shorts} size={size}/>;
}

// ── Type colors ────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  Easy:         { bg:"#e8f5e9", text:"#2e7d32", border:"#a5d6a7" },
  Long:         { bg:"#e3f2fd", text:"#1565c0", border:"#90caf9" },
  Tempo:        { bg:"#fff3e0", text:"#b84800", border:"#ffcc80" },
  Intervals:    { bg:"#fce4ec", text:"#880e4f", border:"#f48fb1" },
  "Time Trial": { bg:"#ede7f6", text:"#4527a0", border:"#9575cd" },
  Shakeout:     { bg:"#f3e5f5", text:"#6a1b9a", border:"#ce93d8" },
  Rest:         { bg:"#f5f5f5", text:"#616161", border:"#e0e0e0" },
  Race:         { bg:dark,      text:"#fff",    border:dark },
};

const FEEL_OPTS = ["💀 Died", "😤 Hard", "😊 Good", "😎 Easy"];
const FEEL_COLS = ["#c0392b","#e67e22","#27ae60","#2980b9"];

// ── API call ───────────────────────────────────────────────────────────────
async function callClaude(prompt) {
  try {
    console.log("callClaude: firing API request");
    const res = await fetch("/api/generate-plan", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ prompt }),
    });
    console.log("callClaude: got response", res.status);
    const data = await res.json();
    console.log("callClaude: data", JSON.stringify(data).slice(0, 200));
    const text = data.text || "[]";
    const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
    console.log("callClaude: parsed", Array.isArray(parsed) ? parsed.length + " items" : typeof parsed);
    return parsed;
  } catch(e) {
    console.error("callClaude error:", e);
    return null;
  }
}

// ── Generate initial full plan ─────────────────────────────────────────────
async function generateInitialPlan({ name, paces, daysPerWeek, assessment, startDate }) {
  const schedule = buildSchedule(daysPerWeek, startDate || new Date());
  const today = new Date(); today.setHours(0,0,0,0);

  // Cap slots to avoid timeout
  const maxSlots = Math.min(schedule.length, 30);
  const scheduleToFill = schedule.slice(0, maxSlots);

  const scheduleText = scheduleToFill.map((d, i) => {
    const daysOut = dateDiffDays(today, d);
    const daysToRaceVal = dateDiffDays(d, RACE_DAY);
    const isRace = d.getTime() === RACE_DAY.getTime();
    return `Slot ${i+1}: ${formatDate(d)} (${daysOut===0?"TODAY":`in ${daysOut}d`}, ${daysToRaceVal}d to race)${isRace?" ← RACE DAY":""}`;
  }).join("\n");

  const prompt = `You are a running coach. Build a training plan for ${name} for a 2.5-mile race on Sep 11, 2026.

GOAL: finish in ${fmt(paces.goalSecs)} (${paces.racePace} pace)
TRAINING PACES: easy ${paces.easy} | tempo ${paces.tempo} | race pace ${paces.racePace} | long ${paces.long}
DAYS PER WEEK: ${daysPerWeek}
TOTAL SLOTS TO FILL: ${maxSlots}

RUNNER ASSESSMENT:
${assessment}

SCHEDULE SLOTS (assign one workout per slot):
${scheduleText}

BUILD A COMPLETE OPTIMISTIC PLAN assuming the runner will complete all workouts as prescribed. Progress through these phases:
- BASE (slots 1-${Math.round(maxSlots*0.25)}): Easy and Long runs only.
- VOLUME (slots ${Math.round(maxSlots*0.25)+1}-${Math.round(maxSlots*0.45)}): Add Tempo runs.
- SPEED (slots ${Math.round(maxSlots*0.45)+1}-${Math.round(maxSlots*0.75)}): Add Intervals.
- TAPER (last 4 slots): Reduce volume, keep sharpness.
- Final slot must be Race Day if Sep 11 is included, otherwise end with Taper.

Adjust phase lengths based on the runner's assessment. If they're experienced, compress Base. If beginner, extend Base.

Return ONLY a raw JSON array with exactly ${maxSlots} entries:
[{"id":"s1","scheduledDate":"2026-07-04","label":"Fri Jul 4","daysToRace":69,"type":"Easy","desc":"3 mi easy (${paces.easy})","phase":"Base","coachNote":"Starting with easy miles to build your aerobic base."}]`;

  const result = await callClaude(prompt);
  if (!result || !Array.isArray(result) || result.length < 5) return null;
  // Attach real dates from schedule
  return result.map((w, i) => ({
    ...w,
    scheduledDate: scheduleToFill[i] ? scheduleToFill[i].toISOString() : w.scheduledDate,
    daysToRace: scheduleToFill[i] ? dateDiffDays(scheduleToFill[i], RACE_DAY) : w.daysToRace,
    label: scheduleToFill[i] ? formatDate(scheduleToFill[i]) : w.label,
  }));
}

// ── Adjust plan after log ──────────────────────────────────────────────────
async function adjustPlan({ name, paces, history, remainingPlan }) {
  if (!remainingPlan || remainingPlan.length === 0) return remainingPlan;

  const recentHistory = history.slice(-6).map((h, i) => {
    const n = Math.max(1, history.length-6)+i+1;
    if (h.status==="skipped") return `#${n} [SKIPPED] ${h.type} on ${h.label}${h.skipReason?` — ${h.skipReason}`:""}`;
    if (h.status==="incomplete") return `#${n} [COULDN'T FINISH] ${h.type} on ${h.label} — stopped at ${h.stoppedAt||"unknown"}${h.notes?`, ${h.notes}`:""}`;
    return `#${n} [DONE] ${h.type} on ${h.label} — felt ${h.feel}${h.pace?`, actual pace: ${h.pace}`:""}${h.notes?`, ${h.notes}`:""}`;
  }).join("\n");

  const lastEntry = history[history.length-1];
  const needsAdjust = lastEntry?.status==="skipped" || lastEntry?.status==="incomplete" ||
    lastEntry?.feel==="💀 Died" || lastEntry?.feel==="\ud83d\ude24 Hard";

  if (!needsAdjust) return remainingPlan; // No adjustment needed

  const scheduleText = remainingPlan.map((w, i) =>
    `Slot ${i+1}: ${w.label} (${w.daysToRace}d to race) — currently: ${w.type} — ${w.desc}`
  ).join("\n");

  const prompt = `You are a running coach adjusting ${name}'s training plan based on recent performance.

PACES: easy ${paces.easy} | tempo ${paces.tempo} | race pace ${paces.racePace}
RACE: Sep 11, 2026 (${daysToRace()} days away)

RECENT HISTORY:
${recentHistory}

REMAINING PLAN TO ADJUST:
${scheduleText}

The runner is struggling (skipped, couldn't finish, or found workouts very hard). Adjust the remaining plan:
- Reduce intensity or volume as needed
- Don't change more than necessary
- Keep race day on Sep 11
- Return the same number of slots (${remainingPlan.length})

Return ONLY a raw JSON array with ${remainingPlan.length} entries using the same format:
[{"id":"s1","scheduledDate":"2026-07-10","label":"Fri Jul 10","daysToRace":63,"type":"Easy","desc":"2.5 mi easy (${paces.easy})","phase":"Base","coachNote":"Scaling back after a tough week."}]`;

  const result = await callClaude(prompt);
  if (!result || !Array.isArray(result) || result.length < 1) return remainingPlan;
  // Keep original dates, just update workout content
  return result.map((w, i) => ({
    ...w,
    scheduledDate: remainingPlan[i]?.scheduledDate || w.scheduledDate,
    daysToRace: remainingPlan[i]?.daysToRace || w.daysToRace,
    label: remainingPlan[i]?.label || w.label,
  }));
}

// ── Auth screen ────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(""); setLoading(true);
    try {
      if (mode==="signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Auto sign in after signup
        const { data, error: e2 } = await supabase.auth.signInWithPassword({ email, password });
        if (e2) throw e2;
        onAuth(data.user);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuth(data.user);
      }
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth:420, margin:"0 auto", padding:"48px 24px", background:"#f7f7f5", minHeight:"100vh" }}>
      <div style={{ fontSize:10, fontWeight:800, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.18em", marginBottom:8 }}>Race Training</div>
      <h1 style={{ fontSize:28, fontWeight:900, color:"#111", margin:"0 0 32px", letterSpacing:"-0.02em", lineHeight:1.1 }}>
        {mode==="login"?"Welcome back.":"Create your"}<br/>
        <span style={{ color:accent }}>{mode==="login"?"Log in to continue.":"account."}</span>
      </h1>
      {["email","password"].map(f => (
        <input key={f} type={f} value={f==="email"?email:password}
          onChange={e => f==="email"?setEmail(e.target.value):setPassword(e.target.value)}
          placeholder={f==="email"?"Email address":"Password"}
          style={{ width:"100%", padding:"12px 14px", fontSize:15, border:"1.5px solid #e0e0e0",
            borderRadius:10, color:"#111", background:"#fff", boxSizing:"border-box",
            fontFamily:"inherit", marginBottom:10 }}/>
      ))}
      {error && <div style={{ padding:"10px 12px", background:"#fce4ec", borderRadius:8, fontSize:13, color:accent, marginBottom:12 }}>{error}</div>}
      <button onClick={handleSubmit} disabled={loading||!email||!password}
        style={{ width:"100%", padding:"14px 0", borderRadius:10, border:"none",
          background:email&&password?accent:"#e0e0e0", color:"#fff", fontWeight:800, fontSize:15,
          cursor:email&&password?"pointer":"default", marginBottom:16 }}>
        {loading?"...":(mode==="login"?"Log in":"Create account")}
      </button>
      <div style={{ textAlign:"center", fontSize:13, color:"#aaa" }}>
        {mode==="login"?"No account? ":"Already have one? "}
        <button onClick={()=>{setMode(mode==="login"?"signup":"login");setError("");}}
          style={{ background:"none", border:"none", color:accent, fontWeight:700, fontSize:13, cursor:"pointer" }}>
          {mode==="login"?"Sign up":"Log in"}
        </button>
      </div>
    </div>
  );
}

// ── Avatar builder ─────────────────────────────────────────────────────────
function AvatarBuilder({ value, onChange }) {
  const config = value || { pose:0, skin:SKIN_TONES[2], jersey:JERSEY_COLORS[0], shorts:SHORTS_COLORS[0] };

  const swatch = (color, selected, onClick) => (
    <button key={color} onClick={()=>onClick(color)} style={{
      width:28, height:28, borderRadius:"50%", background:color, border:`3px solid ${selected?"#111":"transparent"}`,
      cursor:"pointer", outline:"none", flexShrink:0 }}/>
  );

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}>
        <RunnerSVG {...config} size={100}/>
      </div>

      {/* Pose picker */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Pose</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {[0,1,2,3,4,5,6,7].map(p => (
            <button key={p} onClick={()=>onChange({...config,pose:p})}
              style={{ padding:4, borderRadius:8, border:`2px solid ${config.pose===p?accent:"#e0e0e0"}`,
                background:config.pose===p?"#fff5f5":"#fff", cursor:"pointer" }}>
              <RunnerSVG {...config} pose={p} size={40}/>
            </button>
          ))}
        </div>
      </div>

      {/* Skin tone */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Skin tone</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {SKIN_TONES.map(c => swatch(c, config.skin===c, s=>onChange({...config,skin:s})))}
        </div>
      </div>

      {/* Jersey */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Jersey</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {JERSEY_COLORS.map(c => swatch(c, config.jersey===c, j=>onChange({...config,jersey:j})))}
        </div>
      </div>

      {/* Shorts */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Shorts</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {SHORTS_COLORS.map(c => swatch(c, config.shorts===c, s=>onChange({...config,shorts:s})))}
        </div>
      </div>
    </div>
  );
}

// ── Setup screen ───────────────────────────────────────────────────────────
function SetupScreen({ runnerSlot, onSave }) {
  const [step, setStep] = useState(1); // 1=pace, 2=assessment, 3=avatar
  const [name, setName] = useState("");
  const [paceMode, setPaceMode] = useState("goal"); // goal | mile | avgpace
  const [goalMin, setGoalMin] = useState(16); const [goalSec, setGoalSec] = useState(0);
  const [mileMin, setMileMin] = useState(7);  const [mileSec, setMileSec] = useState(0);
  const [paceMin, setPaceMin] = useState(7);  const [paceSec, setPaceSec] = useState(0);
  const [days, setDays] = useState(4);
  const [avatar, setAvatar] = useState({ pose:0, skin:SKIN_TONES[2], jersey:JERSEY_COLORS[0], shorts:SHORTS_COLORS[0] });
  const [assessment, setAssessment] = useState({
    level: "", weeklyMiles: "", longestRun: "", lastRace: "", injuries: "", notes: ""
  });

  const paces = paceMode==="goal" ? calcPaces(toSecs(goalMin,goalSec))
    : paceMode==="mile" ? calcFromMile(toSecs(mileMin,mileSec))
    : calcFromAvgPace(toSecs(paceMin,paceSec));

  const numInp = (v, set, min, max, label) => (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <input type="number" min={min} max={max} value={v} onChange={e=>set(e.target.value)}
        style={{ width:62, padding:"10px 6px", fontSize:22, fontWeight:800, textAlign:"center",
          border:"1.5px solid #e0e0e0", borderRadius:8, color:"#111", background:"#fff", fontFamily:"inherit" }}/>
      <span style={{ fontSize:10, color:"#aaa", fontWeight:700 }}>{label}</span>
    </div>
  );

  const handleSave = () => {
    const assessmentText = `Experience level: ${assessment.level}. Weekly miles: ${assessment.weeklyMiles}. Longest recent run: ${assessment.longestRun}. Last race: ${assessment.lastRace}. Injuries/limitations: ${assessment.injuries||"none"}. Additional notes: ${assessment.notes||"none"}.`;
    onSave({ name: name.trim()||runnerSlot, paces, daysPerWeek:days, avatar, assessmentText });
  };

  const aField = (key, label, placeholder) => (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6 }}>{label}</div>
      <input value={assessment[key]} onChange={e=>setAssessment({...assessment,[key]:e.target.value})}
        placeholder={placeholder}
        style={{ width:"100%", padding:"10px 12px", fontSize:14, border:"1.5px solid #e0e0e0",
          borderRadius:8, color:"#111", background:"#fff", boxSizing:"border-box", fontFamily:"inherit" }}/>
    </div>
  );

  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"32px 16px", background:"#f7f7f5", minHeight:"100vh" }}>
      <div style={{ fontSize:10, fontWeight:800, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.18em", marginBottom:8 }}>
        {runnerSlot} · Step {step} of 3
      </div>

      {/* Step indicator */}
      <div style={{ display:"flex", gap:6, marginBottom:24 }}>
        {[1,2,3].map(s => (
          <div key={s} style={{ flex:1, height:3, borderRadius:2,
            background:s<=step?accent:"#e0e0e0", transition:"background 0.3s" }}/>
        ))}
      </div>

      {step===1 && (
        <>
          <h1 style={{ fontSize:26, fontWeight:900, color:"#111", margin:"0 0 6px", letterSpacing:"-0.02em" }}>
            Set your <span style={{ color:accent }}>goal.</span>
          </h1>
          <p style={{ fontSize:13, color:"#aaa", marginBottom:20 }}>We'll build your full plan around this.</p>

          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Your name</div>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="First name"
              style={{ width:"100%", padding:"12px 14px", fontSize:15, fontWeight:600,
                border:"1.5px solid #e0e0e0", borderRadius:10, color:"#111", background:"#fff",
                boxSizing:"border-box", fontFamily:"inherit" }}/>
          </div>

          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Build from</div>
            <div style={{ display:"flex", gap:6 }}>
              {[["goal","Goal time"],["mile","Mile PR"],["avgpace","Avg pace"]].map(([m,l]) => (
                <button key={m} onClick={()=>setPaceMode(m)} style={{ flex:1, padding:"9px 4px", borderRadius:8,
                  border:`1.5px solid ${paceMode===m?accent:"#e0e0e0"}`,
                  background:paceMode===m?accent:"#fff", color:paceMode===m?"#fff":"#666",
                  fontWeight:700, fontSize:12, cursor:"pointer" }}>{l}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom:16, padding:16, background:"#fff", borderRadius:12, border:"1.5px solid #e0e0e0" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12 }}>
              {paceMode==="goal"?"2.5 mile goal time":paceMode==="mile"?"Mile PR":"Avg mile pace for race"}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {paceMode==="goal" && <>{numInp(goalMin,setGoalMin,10,45,"MIN")}<span style={{ fontSize:24, fontWeight:800, color:"#ddd", marginBottom:14 }}>:</span>{numInp(String(goalSec).padStart(2,"0"),setGoalSec,0,59,"SEC")}</>}
              {paceMode==="mile" && <>{numInp(mileMin,setMileMin,4,15,"MIN")}<span style={{ fontSize:24, fontWeight:800, color:"#ddd", marginBottom:14 }}>:</span>{numInp(String(mileSec).padStart(2,"0"),setMileSec,0,59,"SEC")}<div style={{ marginLeft:8, padding:"10px 14px", background:"#f7f7f5", borderRadius:8, border:"1.5px solid #e8e8e8" }}><div style={{ fontSize:10, color:"#aaa", fontWeight:700 }}>EST. GOAL</div><div style={{ fontSize:19, fontWeight:900, color:accent }}>{paces.estimatedGoal}</div></div></>}
              {paceMode==="avgpace" && <>{numInp(paceMin,setPaceMin,4,15,"MIN")}<span style={{ fontSize:24, fontWeight:800, color:"#ddd", marginBottom:14 }}>:</span>{numInp(String(paceSec).padStart(2,"0"),setPaceSec,0,59,"SEC")}<span style={{ fontSize:14, color:"#aaa", marginBottom:14, fontWeight:600 }}>/mi</span><div style={{ marginLeft:8, padding:"10px 14px", background:"#f7f7f5", borderRadius:8, border:"1.5px solid #e8e8e8" }}><div style={{ fontSize:10, color:"#aaa", fontWeight:700 }}>GOAL TIME</div><div style={{ fontSize:19, fontWeight:900, color:accent }}>{fmt(toSecs(paceMin,paceSec)*2.5)}</div></div></>}
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20 }}>
            {[["Race",paces.racePace,accent],["Tempo",paces.tempo,"#b84800"],["Easy",paces.easy,"#2e7d32"],["Long",paces.long,"#1565c0"]].map(([l,v,c]) => (
              <div key={l} style={{ padding:"10px 12px", background:"#fff", border:"1.5px solid #e8e8e8", borderRadius:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#bbb", textTransform:"uppercase", letterSpacing:"0.08em" }}>{l}</div>
                <div style={{ fontSize:14, fontWeight:800, color:c, marginTop:2 }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Days per week</div>
            <div style={{ display:"flex", gap:8 }}>
              {[3,4,5].map(d => (
                <button key={d} onClick={()=>setDays(d)} style={{ flex:1, padding:"12px 0", borderRadius:8,
                  border:`1.5px solid ${days===d?accent:"#e0e0e0"}`,
                  background:days===d?accent:"#fff", color:days===d?"#fff":"#666",
                  fontWeight:900, fontSize:20, cursor:"pointer" }}>{d}</button>
              ))}
            </div>
          </div>

          <button onClick={()=>setStep(2)}
            style={{ width:"100%", padding:"16px 0", borderRadius:12, border:"none",
              background:accent, color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer" }}>
            Next: Tell us about yourself →
          </button>
        </>
      )}

      {step===2 && (
        <>
          <h1 style={{ fontSize:26, fontWeight:900, color:"#111", margin:"0 0 6px", letterSpacing:"-0.02em" }}>
            Your <span style={{ color:accent }}>fitness background.</span>
          </h1>
          <p style={{ fontSize:13, color:"#aaa", marginBottom:20 }}>The coach uses this to build the right plan for you.</p>

          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Experience level</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {["Beginner","Casual","Intermediate","Advanced"].map(l => (
                <button key={l} onClick={()=>setAssessment({...assessment,level:l})} style={{
                  padding:"8px 14px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer",
                  border:`1.5px solid ${assessment.level===l?accent:"#e0e0e0"}`,
                  background:assessment.level===l?accent:"#fff",
                  color:assessment.level===l?"#fff":"#666" }}>{l}</button>
              ))}
            </div>
          </div>

          {aField("weeklyMiles","Current weekly mileage","e.g. 10-15 miles")}
          {aField("longestRun","Longest run in past month","e.g. 4 miles")}
          {aField("lastRace","Last race / recent PR","e.g. 5K in 24:00 two months ago")}
          {aField("injuries","Injuries or limitations","e.g. tight calves, none")}
          {aField("notes","Anything else the coach should know","e.g. I train best in mornings")}

          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <button onClick={()=>setStep(1)} style={{ flex:1, padding:"14px 0", borderRadius:10,
              border:"1.5px solid #e0e0e0", background:"#fff", color:"#aaa", fontWeight:700, fontSize:14, cursor:"pointer" }}>← Back</button>
            <button onClick={()=>setStep(3)} disabled={!assessment.level}
              style={{ flex:2, padding:"14px 0", borderRadius:10, border:"none",
                background:assessment.level?accent:"#e0e0e0", color:"#fff", fontWeight:800, fontSize:14, cursor:assessment.level?"pointer":"default" }}>
              Next: Pick your avatar →
            </button>
          </div>
        </>
      )}

      {step===3 && (
        <>
          <h1 style={{ fontSize:26, fontWeight:900, color:"#111", margin:"0 0 6px", letterSpacing:"-0.02em" }}>
            Your <span style={{ color:accent }}>avatar.</span>
          </h1>
          <p style={{ fontSize:13, color:"#aaa", marginBottom:20 }}>Shows up next to your name everywhere.</p>

          <AvatarBuilder value={avatar} onChange={setAvatar}/>

          <div style={{ display:"flex", gap:10, marginTop:20 }}>
            <button onClick={()=>setStep(2)} style={{ flex:1, padding:"14px 0", borderRadius:10,
              border:"1.5px solid #e0e0e0", background:"#fff", color:"#aaa", fontWeight:700, fontSize:14, cursor:"pointer" }}>← Back</button>
            <button onClick={handleSave}
              style={{ flex:2, padding:"14px 0", borderRadius:10, border:"none",
                background:accent, color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" }}>
              Build my plan →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Log modal ──────────────────────────────────────────────────────────────
function LogModal({ workout, paces, onSave, onClose }) {
  const [mode, setMode] = useState("completed");
  const [feel, setFeel] = useState(null);
  const [pace, setPace] = useState("");
  const [notes, setNotes] = useState("");
  const [stoppedAt, setStoppedAt] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const canSave = mode==="completed" ? !!feel : true;

  // Check if runner might want pace fine-tuning
  const fasterThanPrescribed = pace && feel && (feel.includes("Good")||feel.includes("Easy")) && (() => {
    try {
      const [m,s] = pace.replace("/mi","").trim().split(":").map(Number);
      const loggedPace = m*60+s;
      return loggedPace < paces?.racePaceRaw*0.98; // faster than race pace
    } catch { return false; }
  })();

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)",
      display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:100 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:"20px 20px 0 0",
        padding:"24px 20px 44px", width:"100%", maxWidth:480, maxHeight:"88vh", overflowY:"auto" }}>
        <div style={{ width:36, height:4, background:"#e0e0e0", borderRadius:2, margin:"0 auto 20px" }}/>
        <div style={{ fontSize:10, fontWeight:800, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:4 }}>Log workout</div>
        <div style={{ fontSize:17, fontWeight:800, color:"#111", marginBottom:4, lineHeight:1.3 }}>{workout.desc}</div>
        <div style={{ fontSize:12, color:"#aaa", marginBottom:20 }}>{workout.label} · {workout.daysToRace}d to race</div>

        <div style={{ display:"flex", gap:6, marginBottom:20 }}>
          {[["completed","\u2705 Done"],["incomplete","\u26a0\ufe0f Couldn't finish"],["skipped","\u23ed Skipped"]].map(([s,l]) => {
            const active = mode===s;
            const col = s==="completed"?"#27ae60":s==="incomplete"?"#e67e22":"#f57f17";
            return (
              <button key={s} onClick={()=>setMode(s)} style={{ flex:1, padding:"8px 4px", borderRadius:8,
                fontSize:11, fontWeight:700, cursor:"pointer",
                border:`1.5px solid ${active?col:"#e8e8e8"}`,
                background:active?col+"18":"#fff", color:active?col:"#999" }}>{l}</button>
            );
          })}
        </div>

        {mode==="completed" && (
          <>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#999", marginBottom:8 }}>How did it feel?</div>
              <div style={{ display:"flex", gap:6 }}>
                {FEEL_OPTS.map((f,i) => (
                  <button key={f} onClick={()=>setFeel(f)} style={{ flex:1, padding:"9px 4px", borderRadius:8,
                    fontSize:11, fontWeight:700, cursor:"pointer",
                    border:`1.5px solid ${feel===f?FEEL_COLS[i]:"#e8e8e8"}`,
                    background:feel===f?FEEL_COLS[i]:"#fff", color:feel===f?"#fff":"#888" }}>{f}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#999", marginBottom:8 }}>Actual pace (optional)</div>
              <input value={pace} onChange={e=>setPace(e.target.value)} placeholder="e.g. 7:15/mi"
                style={{ width:"100%", padding:"10px 12px", fontSize:14, border:"1.5px solid #e8e8e8",
                  borderRadius:8, boxSizing:"border-box", fontFamily:"inherit" }}/>
            </div>
            {fasterThanPrescribed && (
              <div style={{ marginBottom:16, padding:12, background:"#e8f5e9", borderRadius:10, border:"1.5px solid #a5d6a7" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#2e7d32", marginBottom:4 }}>
                  \u26a1 You're running faster than prescribed!
                </div>
                <div style={{ fontSize:12, color:"#388e3c" }}>
                  Want to fine-tune your paces based on today's performance? You can do this after saving.
                </div>
              </div>
            )}
          </>
        )}
        {mode==="incomplete" && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, padding:10, background:"#fff3e0", borderRadius:8, color:"#b84800", marginBottom:12, lineHeight:1.5 }}>The plan will adapt based on this.</div>
            <div style={{ fontSize:11, fontWeight:700, color:"#999", marginBottom:8 }}>Where did you stop?</div>
            <input value={stoppedAt} onChange={e=>setStoppedAt(e.target.value)} placeholder="e.g. after 2 reps, at 1.5 miles..."
              style={{ width:"100%", padding:"10px 12px", fontSize:14, border:"1.5px solid #e8e8e8", borderRadius:8, boxSizing:"border-box", fontFamily:"inherit" }}/>
          </div>
        )}
        {mode==="skipped" && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, padding:10, background:"#fff8e1", borderRadius:8, color:"#f57f17", marginBottom:12, lineHeight:1.5 }}>The plan will adapt around missed days.</div>
            <div style={{ fontSize:11, fontWeight:700, color:"#999", marginBottom:8 }}>Reason (optional)</div>
            <input value={skipReason} onChange={e=>setSkipReason(e.target.value)} placeholder="travel, sick, injury..."
              style={{ width:"100%", padding:"10px 12px", fontSize:14, border:"1.5px solid #e8e8e8", borderRadius:8, boxSizing:"border-box", fontFamily:"inherit" }}/>
          </div>
        )}

        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#999", marginBottom:8 }}>Notes (optional)</div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
            placeholder="Anything the coach should know..."
            style={{ width:"100%", padding:"10px 12px", fontSize:13, border:"1.5px solid #e8e8e8",
              borderRadius:8, resize:"none", boxSizing:"border-box", fontFamily:"inherit" }}/>
        </div>

        <button onClick={()=>canSave&&onSave({ status:mode, feel, pace, notes, stoppedAt, skipReason, suggestPaceTuning:fasterThanPrescribed })}
          disabled={!canSave} style={{ width:"100%", padding:"14px 0", borderRadius:10, border:"none",
            background:canSave?accent:"#e0e0e0", color:"#fff", fontWeight:800, fontSize:15,
            cursor:canSave?"pointer":"default" }}>
          Save & update plan
        </button>
      </div>
    </div>
  );
}

// ── Pace tuning modal ──────────────────────────────────────────────────────
function PaceTuningModal({ currentPaces, onAccept, onDismiss }) {
  // Suggest ~5% faster paces based on performance
  const newRaceRaw = currentPaces.racePaceRaw * 0.95;
  const newPaces = calcPaces(newRaceRaw * 2.5);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:16 }}>
      <div style={{ background:"#fff", borderRadius:16, padding:24, width:"100%", maxWidth:400 }}>
        <div style={{ fontSize:22, marginBottom:8 }}>\u26a1</div>
        <div style={{ fontSize:18, fontWeight:800, color:"#111", marginBottom:8 }}>Fine-tune your paces?</div>
        <div style={{ fontSize:13, color:"#666", marginBottom:20, lineHeight:1.6 }}>
          Based on your recent performance, your paces can be updated. This will rebuild your remaining plan.
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20 }}>
          {[["Race",currentPaces.racePace,newPaces.racePace,accent],["Tempo",currentPaces.tempo,newPaces.tempo,"#b84800"],["Easy",currentPaces.easy,newPaces.easy,"#2e7d32"]].map(([l,old_,new_,c]) => (
            <div key={l} style={{ padding:"10px 12px", background:"#f7f7f5", borderRadius:10, border:"1.5px solid #e8e8e8" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#bbb", textTransform:"uppercase" }}>{l}</div>
              <div style={{ fontSize:12, color:"#aaa", textDecoration:"line-through" }}>{old_}</div>
              <div style={{ fontSize:14, fontWeight:800, color:c }}>{new_}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onDismiss} style={{ flex:1, padding:"12px 0", borderRadius:10,
            border:"1.5px solid #e0e0e0", background:"#fff", color:"#aaa", fontWeight:700, fontSize:14, cursor:"pointer" }}>Keep current</button>
          <button onClick={()=>onAccept(newPaces)} style={{ flex:2, padding:"12px 0", borderRadius:10,
            border:"none", background:accent, color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" }}>Update paces</button>
        </div>
      </div>
    </div>
  );
}

// ── Next workout card ──────────────────────────────────────────────────────
function NextWorkoutCard({ workout, generating, onLog }) {
  if (generating) return (
    <div style={{ padding:20, background:"#fff", borderRadius:16, marginBottom:20,
      border:"1.5px solid #e8e8e8", textAlign:"center" }}>
      <div style={{ fontSize:13, color:"#aaa", fontStyle:"italic" }}>Coach is building your plan...</div>
    </div>
  );
  if (!workout) return (
    <div style={{ padding:24, background:dark, borderRadius:16, marginBottom:20, textAlign:"center" }}>
      <div style={{ fontSize:32, marginBottom:8 }}>\ud83c\udfc1</div>
      <div style={{ fontSize:18, fontWeight:800, color:"#fff" }}>Race day is here.</div>
      <div style={{ fontSize:13, color:"#666", marginTop:4 }}>Sep 11, 2026 — give everything.</div>
    </div>
  );
  const c = TYPE_COLORS[workout.type] || TYPE_COLORS.Easy;
  const isRace = workout.type==="Race";
  const today = new Date(); today.setHours(0,0,0,0);
  const workoutDate = workout.scheduledDate ? new Date(workout.scheduledDate) : null;
  workoutDate?.setHours(0,0,0,0);
  const isToday = workoutDate && workoutDate.getTime()===today.getTime();
  const isFuture = workoutDate && workoutDate > today;

  return (
    <div style={{ marginBottom:20, background:isRace?dark:"#fff", borderRadius:16,
      border:`2px solid ${isRace?dark:isToday?accent:"#e8e8e8"}`, overflow:"hidden" }}>
      <div style={{ padding:"16px 18px 0" }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:8 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:800, color:isRace?"#555":isToday?accent:"#aaa",
              textTransform:"uppercase", letterSpacing:"0.15em", marginBottom:2 }}>
              {isToday?"TODAY":isFuture?"NEXT UP":"UP NEXT"} · {workout.label}
            </div>
            {workout.daysToRace != null && (
              <div style={{ fontSize:11, color:isRace?"#444":"#bbb" }}>
                {workout.daysToRace===0?"Race day!":workout.daysToRace===1?"1 day to race":`${workout.daysToRace} days to race`}
              </div>
            )}
          </div>
          <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20,
            background:c.bg, color:c.text, border:`1px solid ${c.border}`, whiteSpace:"nowrap" }}>{workout.type}</span>
        </div>
        <div style={{ fontSize:19, fontWeight:900, color:isRace?"#fff":"#111", lineHeight:1.25, marginBottom:8 }}>{workout.desc}</div>
        {workout.phase && (
          <div style={{ fontSize:10, fontWeight:700, color:isRace?"#333":"#ccc",
            textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>{workout.phase}</div>
        )}
        {workout.coachNote && (
          <div style={{ fontSize:13, color:isRace?"#555":"#888", lineHeight:1.6,
            paddingTop:10, borderTop:`1px solid ${isRace?"#1a1a2e":"#f0f0f0"}`,
            fontStyle:"italic" }}>{workout.coachNote}</div>
        )}
      </div>
      {!isRace && (
        <button onClick={onLog} style={{ width:"100%", padding:"14px 18px", background:accent,
          border:"none", color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer",
          textAlign:"left", display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:16 }}>
          <span>Log this workout</span><span style={{ fontSize:20 }}>→</span>
        </button>
      )}
    </div>
  );
}

// ── Unified timeline ───────────────────────────────────────────────────────
function UnifiedTimeline({ history, plan }) {
  const [showAll, setShowAll] = useState(false);
  const feelColors = ["#c0392b","#e67e22","#27ae60","#2980b9"];
  const feelOpts = ["💀 Died", "😤 Hard", "😊 Good", "😎 Easy"];
  const statusIcon = s => s==="completed"?"\u2705":s==="skipped"?"\u23ed":"\u26a0\ufe0f";

  // Upcoming = everything after first item (shown in NextWorkoutCard)
  const upcoming = plan.slice(1);
  const upcomingShown = showAll ? upcoming : upcoming.slice(0, 6);

  return (
    <div style={{ marginBottom:20 }}>
      {/* Logged */}
      {history.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:8 }}>Logged</div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {[...history].reverse().map((h,i) => {
              const fi = feelOpts.indexOf(h.feel);
              return (
                <div key={i} style={{ padding:"10px 12px", background:"#fff", borderRadius:10, border:"1.5px solid #ebebeb" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <span style={{ fontSize:14 }}>{statusIcon(h.status)}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:"#aaa" }}>{h.label}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:"#111" }}>{h.type}</span>
                    {h.feel && <span style={{ fontSize:12, fontWeight:600, color:fi>=0?feelColors[fi]:"#888" }}>{h.feel}</span>}
                    {h.pace && <span style={{ fontSize:11, color:"#aaa" }}>\u00b7 {h.pace}</span>}
                    {h.daysToRace != null && <span style={{ fontSize:10, color:"#ccc", marginLeft:"auto" }}>{h.daysToRace}d to race</span>}
                  </div>
                  <div style={{ fontSize:12, color:"#aaa", marginTop:3, paddingLeft:22 }}>{h.desc}</div>
                  {(h.notes||h.skipReason||h.stoppedAt) && (
                    <div style={{ fontSize:12, color:"#999", marginTop:3, paddingLeft:22, fontStyle:"italic" }}>
                      {h.skipReason||h.stoppedAt||h.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <div style={{ fontSize:11, fontWeight:800, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:8 }}>Coming up</div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {upcomingShown.map((w,i) => {
              const c = TYPE_COLORS[w.type] || TYPE_COLORS.Easy;
              const isRace = w.type==="Race";
              return (
                <div key={w.id||i} style={{ display:"flex", alignItems:"flex-start", gap:8,
                  padding:"10px 12px", background:isRace?dark:"#fff", borderRadius:10,
                  border:`1.5px solid ${isRace?"#1a1a2e":"#ebebeb"}` }}>
                  <div style={{ minWidth:72, flexShrink:0 }}>
                    <div style={{ fontSize:10, fontWeight:800, color:isRace?"#555":"#bbb", lineHeight:1.3 }}>{w.label}</div>
                    {w.daysToRace != null && <div style={{ fontSize:9, color:isRace?"#444":"#ccc" }}>{w.daysToRace}d to race</div>}
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, padding:"2px 7px", borderRadius:20,
                    background:c.bg, color:c.text, border:`1px solid ${c.border}`,
                    whiteSpace:"nowrap", flexShrink:0, marginTop:1 }}>{w.type}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, color:isRace?"#bbb":"#444", lineHeight:1.4 }}>{w.desc}</div>
                    {w.phase && <div style={{ fontSize:9, fontWeight:700, color:isRace?"#333":"#ccc",
                      marginTop:2, textTransform:"uppercase", letterSpacing:"0.08em" }}>{w.phase}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {upcoming.length > 6 && (
            <button onClick={()=>setShowAll(s=>!s)} style={{ width:"100%", marginTop:8,
              padding:"10px 0", background:"none", border:"1.5px solid #e8e8e8", borderRadius:10,
              fontSize:12, fontWeight:700, color:"#aaa", cursor:"pointer" }}>
              {showAll?"Show less \u2191":`Show all ${upcoming.length} workouts \u2193`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Group panel ────────────────────────────────────────────────────────────
function GroupPanel({ currentName, allProfiles }) {
  const [tab, setTab] = useState("squad");
  const [counts, setCounts] = useState({});

  useEffect(() => {
    (async () => {
      const c = {};
      for (const n of RUNNERS) {
        const h = await load(`history-${n}`);
        c[n] = { total:h?.length||0, done:h?.filter(x=>x.status==="completed").length||0 };
      }
      setCounts(c);
    })();
  }, [currentName]);

  return (
    <div style={{ marginBottom:20, background:"#fff", borderRadius:12, border:"1.5px solid #e8e8e8", overflow:"hidden" }}>
      <div style={{ display:"flex", borderBottom:"1.5px solid #f0f0f0" }}>
        {[["squad","Squad"],["projection","10-Mile"]].map(([t,l]) => (
          <button key={t} onClick={()=>setTab(t)} style={{ flex:1, padding:"10px 0",
            fontSize:11, fontWeight:800, border:"none", cursor:"pointer",
            background:tab===t?"#fff":"#f7f7f5", color:tab===t?"#111":"#aaa",
            borderBottom:tab===t?`2px solid ${accent}`:"2px solid transparent" }}>{l}</button>
        ))}
      </div>
      <div style={{ padding:14 }}>
        {tab==="squad" && RUNNERS.map(slot => {
          const profile = allProfiles[slot];
          const c = counts[slot] || { total:0, done:0 };
          const isMe = slot===currentName;
          const pct = c.total>0 ? Math.round((c.done/c.total)*100) : 0;
          return (
            <div key={slot} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <Avatar config={profile?.avatar} size={28}/>
                <span style={{ fontSize:12, fontWeight:isMe?800:500, color:isMe?"#111":"#888", flex:1 }}>
                  {profile?.name || slot}{isMe?" (you)":""}
                </span>
                <span style={{ fontSize:11, fontWeight:700, color:isMe?accent:"#bbb" }}>{c.done} runs · {pct}%</span>
              </div>
              <div style={{ height:4, background:"#f0f0f0", borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct}%`, background:isMe?accent:"#ddd", borderRadius:2, transition:"width 0.4s" }}/>
              </div>
            </div>
          );
        })}
        {tab==="projection" && (
          <div>
            <div style={{ fontSize:11, color:"#aaa", marginBottom:12, lineHeight:1.5 }}>Projected 10-mile from goal pace (Riegel formula).</div>
            {RUNNERS.map(slot => {
              const profile = allProfiles[slot];
              const isMe = slot===currentName;
              if (!profile) return (
                <div key={slot} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, opacity:0.35 }}>
                  <Avatar config={null} size={28}/>
                  <span style={{ fontSize:13, color:"#aaa", flex:1 }}>{slot}</span>
                  <span style={{ fontSize:12, color:"#ccc" }}>Not set up</span>
                </div>
              );
              return (
                <div key={slot} style={{ marginBottom:10, padding:"10px 12px", borderRadius:8,
                  background:isMe?"#fff5f5":"#f7f7f5", border:`1.5px solid ${isMe?accent+"33":"#ebebeb"}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <Avatar config={profile.avatar} size={32}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:isMe?800:500, color:isMe?"#111":"#666" }}>
                        {profile.name||slot}{isMe?" \u2605":""}
                      </div>
                      <div style={{ fontSize:11, color:"#bbb" }}>Race pace: {profile.paces?.racePace}</div>
                    </div>
                    <span style={{ fontSize:19, fontWeight:900, color:isMe?accent:"#999" }}>
                      {project10Mile(profile.paces?.racePaceRaw)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Plan view ──────────────────────────────────────────────────────────────
function PlanView({ runner, currentSlot, allProfiles, onReset }) {
  const { name, paces, daysPerWeek, assessmentText, avatar } = runner;
  const [plan, setPlan] = useState([]);
  const [history, setHistory] = useState([]);
  const [logging, setLogging] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPaceTuning, setShowPaceTuning] = useState(false);
  const [currentPaces, setCurrentPaces] = useState(paces);
  const historyRef = useRef([]);

  useEffect(() => {
    (async () => {
      const h = await load(`history-${currentSlot}`) || [];
      const p = await load(`plan-${currentSlot}`) || [];
      setHistory(h);
      historyRef.current = h;
      setCurrentPaces(runner.paces);
      if (p.length > 0) {
        setPlan(p);
      } else {
        // Generate fresh plan
        setGenerating(true);
        const startDate = new Date().toISOString();
        await save(`planStart-${currentSlot}`, startDate);
        const newPlan = await generateInitialPlan({ name, paces, daysPerWeek, assessment:assessmentText, startDate });
        console.log("generateInitialPlan result:", newPlan ? newPlan.length + " workouts" : "null/empty");
        if (newPlan && newPlan.length > 0) {
          setPlan(newPlan);
          await save(`plan-${currentSlot}`, newPlan);
          console.log("plan saved");
        } else {
          console.error("plan generation returned empty:", newPlan);
        }
        setGenerating(false);
      }
    })();
  }, [currentSlot]);

  // Find next workout (today or nearest future)
  const today = new Date(); today.setHours(0,0,0,0);
  const nextWorkout = plan.find(w => {
    if (!w.scheduledDate) return true;
    const d = new Date(w.scheduledDate); d.setHours(0,0,0,0);
    return d >= today;
  }) || plan[0] || null;

  const handleLog = async (data) => {
    const workout = nextWorkout;
    if (!workout) return;

    const entry = {
      ...data,
      type: workout.type,
      desc: workout.desc,
      label: workout.label,
      scheduledDate: workout.scheduledDate,
      daysToRace: workout.daysToRace,
      loggedAt: new Date().toISOString(),
    };

    const newHistory = [...history, entry];
    setHistory(newHistory);
    historyRef.current = newHistory;
    setLogging(false);
    await save(`history-${currentSlot}`, newHistory);

    // Show pace tuning prompt if applicable
    if (data.suggestPaceTuning) {
      setShowPaceTuning(true);
    }

    // Find logged workout index in plan and get remaining
    const loggedIdx = plan.findIndex(w => w.scheduledDate === workout.scheduledDate);
    const remainingPlan = plan.slice(loggedIdx + 1);

    // Adjust plan if needed (skipped/incomplete/hard)
    const needsAdjust = data.status==="skipped" || data.status==="incomplete" ||
      data.feel==="💀 Died" || data.feel==="\ud83d\ude24 Hard";

    if (needsAdjust && remainingPlan.length > 0) {
      setGenerating(true);
      const adjusted = await adjustPlan({ name, paces:currentPaces, history:newHistory, remainingPlan });
      const newPlan = [...plan.slice(0, loggedIdx+1), ...adjusted];
      setPlan(newPlan);
      await save(`plan-${currentSlot}`, newPlan);
      setGenerating(false);
    }
  };

  const handlePaceAccept = async (newPaces) => {
    setCurrentPaces(newPaces);
    setShowPaceTuning(false);
    // Update profile
    const updatedRunner = { ...runner, paces: newPaces };
    await save(`profile-${currentSlot}`, updatedRunner);
    // Rebuild remaining plan with new paces
    const loggedIdx = plan.findIndex(w => {
      const d = new Date(w.scheduledDate); d.setHours(0,0,0,0);
      return d >= today;
    });
    const donePlan = plan.slice(0, loggedIdx);
    const remainingPlan = plan.slice(loggedIdx);
    setGenerating(true);
    const adjusted = await adjustPlan({ name, paces:newPaces, history:historyRef.current, remainingPlan });
    const newPlan = [...donePlan, ...adjusted];
    setPlan(newPlan);
    await save(`plan-${currentSlot}`, newPlan);
    setGenerating(false);
  };

  const completedCount = history.filter(h=>h.status==="completed").length;
  const totalLogged = history.length;
  const pct = totalLogged>0 ? Math.round((completedCount/totalLogged)*100) : 0;

  return (
    <div style={{ maxWidth:520, margin:"0 auto", padding:"24px 16px 48px", background:"#f7f7f5", minHeight:"100vh" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <Avatar config={avatar} size={48}/>
          <div>
            <div style={{ fontSize:10, fontWeight:800, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.15em" }}>Sep 11, 2026</div>
            <div style={{ fontSize:22, fontWeight:900, color:"#111", letterSpacing:"-0.02em" }}>{name}</div>
            <div style={{ fontSize:11, color:"#aaa" }}>{currentPaces.racePace} goal</div>
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:32, fontWeight:900, color:accent, lineHeight:1 }}>{daysToRace()}</div>
          <div style={{ fontSize:10, fontWeight:700, color:"#aaa" }}>DAYS LEFT</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:20 }}>
        {[["Done",completedCount,"#27ae60"],["Completion",`${pct}%`,pct>=60?accent:"#e67e22"],["Remaining",plan.filter(w=>w.type!=="Race").length,"#1565c0"]].map(([l,v,c]) => (
          <div key={l} style={{ padding:"10px 12px", background:"#fff", borderRadius:10, border:"1.5px solid #ebebeb", textAlign:"center" }}>
            <div style={{ fontSize:20, fontWeight:900, color:c }}>{v}</div>
            <div style={{ fontSize:10, fontWeight:700, color:"#bbb", textTransform:"uppercase", letterSpacing:"0.08em", marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Generating */}
      {generating && (
        <div style={{ marginBottom:16, padding:"12px 16px", background:"#fff", borderRadius:10,
          border:"1.5px solid #e8e8e8", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:accent }}/>
          <span style={{ fontSize:13, color:"#888", fontWeight:600 }}>Coach is updating your plan...</span>
        </div>
      )}

      <NextWorkoutCard workout={nextWorkout} generating={generating} onLog={()=>setLogging(true)}/>
      <GroupPanel currentName={currentSlot} allProfiles={allProfiles}/>
      <UnifiedTimeline history={history} plan={plan}/>

      {/* Paces */}
      <div style={{ marginBottom:20, padding:"12px 14px", background:"#fff", borderRadius:10, border:"1.5px solid #ebebeb" }}>
        <div style={{ fontSize:10, fontWeight:800, color:"#bbb", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Your paces</div>
        <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
          {[["Race",currentPaces.racePace,accent],["Tempo",currentPaces.tempo,"#b84800"],["Easy",currentPaces.easy,"#2e7d32"],["Long",currentPaces.long,"#1565c0"]].map(([l,v,c]) => (
            <div key={l}>
              <div style={{ fontSize:10, color:"#ccc", fontWeight:700 }}>{l}</div>
              <div style={{ fontSize:13, fontWeight:800, color:c }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onReset} style={{ width:"100%", padding:"12px 0", borderRadius:10,
        border:"1.5px solid #e0e0e0", background:"#fff", color:"#bbb", fontSize:13, fontWeight:600, cursor:"pointer" }}>
        ← Switch runner
      </button>

      {logging && nextWorkout && (
        <LogModal workout={nextWorkout} paces={currentPaces} onSave={handleLog} onClose={()=>setLogging(false)}/>
      )}
      {showPaceTuning && (
        <PaceTuningModal currentPaces={currentPaces} onAccept={handlePaceAccept} onDismiss={()=>setShowPaceTuning(false)}/>
      )}
    </div>
  );
}

// ── Runner select ──────────────────────────────────────────────────────────
function RunnerSelect({ onSelect }) {
  const [profiles, setProfiles] = useState({});
  const [stats, setStats] = useState({});

  useEffect(() => {
    (async () => {
      const p = {}, s = {};
      for (const n of RUNNERS) {
        const profile = await load(`profile-${n}`);
        if (profile) p[n] = profile;
        const hist = await load(`history-${n}`) || [];
        s[n] = { done:hist.filter(h=>h.status==="completed").length, total:hist.length };
      }
      setProfiles(p); setStats(s);
    })();
  }, []);

  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"32px 16px", background:"#f7f7f5", minHeight:"100vh" }}>
      <div style={{ fontSize:10, fontWeight:800, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.18em", marginBottom:8 }}>Sep 11, 2026</div>
      <h1 style={{ fontSize:28, fontWeight:900, color:"#111", margin:"0 0 4px", letterSpacing:"-0.02em", lineHeight:1.1 }}>
        Who's running<br/><span style={{ color:accent }}>today?</span>
      </h1>
      <div style={{ fontSize:13, color:"#aaa", marginBottom:28 }}>{daysToRace()} days to race day.</div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {RUNNERS.map(slot => {
          const profile = profiles[slot];
          const s = stats[slot] || { done:0, total:0 };
          const pct = s.total>0 ? Math.round((s.done/s.total)*100) : null;
          return (
            <button key={slot} onClick={()=>onSelect(slot, profile, profiles)}
              style={{ padding:"14px 16px", borderRadius:12, border:"1.5px solid #e4e4e4",
                background:"#fff", textAlign:"left", cursor:"pointer",
                display:"flex", alignItems:"center", gap:12 }}>
              <Avatar config={profile?.avatar} size={44}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:800, fontSize:16, color:"#111" }}>{profile?.name || slot}</div>
                {profile ? (
                  <>
                    <div style={{ fontSize:12, color:"#aaa", marginTop:1 }}>
                      Goal: {profile.paces?.racePace} · {profile.daysPerWeek} days/wk
                    </div>
                    {s.total>0 && (
                      <div style={{ marginTop:6 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <span style={{ fontSize:11, color:"#bbb" }}>{s.done} of {s.total} logged</span>
                          <span style={{ fontSize:11, fontWeight:700, color:pct>=60?accent:"#e67e22" }}>{pct}%</span>
                        </div>
                        <div style={{ height:3, background:"#f0f0f0", borderRadius:2 }}>
                          <div style={{ height:"100%", width:`${pct}%`, background:pct>=60?accent:"#e67e22", borderRadius:2 }}/>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize:12, color:"#ccc", marginTop:1 }}>Tap to set up</div>
                )}
              </div>
              <span style={{ fontSize:22, color:"#ddd" }}>›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(undefined);
  const [screen, setScreen] = useState("select");
  const [currentSlot, setCurrentSlot] = useState(null);
  const slotRef = useRef(null);
  const [runner, setRunner] = useState(null);
  const [allProfiles, setAllProfiles] = useState({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session) { setScreen("select"); setRunner(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSelect = (slot, profile, profiles) => {
    slotRef.current = slot;
    setCurrentSlot(slot);
    setAllProfiles(profiles || {});
    if (profile) { setRunner(profile); setScreen("plan"); }
    else setScreen("setup");
  };

  const handleSetup = async (data) => {
    const slot = slotRef.current;
    const profile = { ...data };
    await save(`profile-${slot}`, profile);
    setRunner(profile);
    setScreen("plan");
  };

  const handleReset = () => { setRunner(null); setCurrentSlot(null); slotRef.current = null; setScreen("select"); };
  const handleSignOut = async () => { await supabase.auth.signOut(); handleReset(); };

  if (user===undefined) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#f7f7f5" }}>
      <div style={{ fontSize:13, color:"#aaa" }}>Loading...</div>
    </div>
  );
  if (!user) return <AuthScreen onAuth={setUser}/>;

  return (
    <div>
      {screen==="select" && (
        <div style={{ position:"relative" }}>
          <button onClick={handleSignOut} style={{ position:"absolute", top:24, right:16,
            background:"none", border:"none", fontSize:12, color:"#ccc", cursor:"pointer", fontFamily:"inherit" }}>Sign out</button>
          <RunnerSelect onSelect={handleSelect}/>
        </div>
      )}
      {screen==="setup" && <SetupScreen runnerSlot={currentSlot} onSave={handleSetup}/>}
      {screen==="plan" && runner && currentSlot && (
        <PlanView runner={runner} currentSlot={currentSlot} allProfiles={allProfiles} onReset={handleReset}/>
      )}
    </div>
  );
}import React, { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Constants ──────────────────────────────────────────────────────────────
const RACE_DAY = new Date("2026-09-11T00:00:00");
const RUNNERS = ["Runner 1", "Runner 2", "Runner 3", "Runner 4"];
const accent = "#c0392b";
const dark = "#0d0d1a";

// ── Storage ────────────────────────────────────────────────────────────────
async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
async function load(key) {
  try {
    const user = await getUser();
    if (!user) return null;
    const { data } = await supabase.from("app_storage").select("value").eq("user_id", user.id).eq("key", key).limit(1);
    return data && data.length > 0 ? JSON.parse(data[0].value) : null;
  } catch { return null; }
}
async function save(key, val) {
  try {
    const user = await getUser();
    if (!user) { console.error("save: no user"); return; }
    const { error } = await supabase.from("app_storage").upsert({ user_id: user.id, key, value: JSON.stringify(val) }, { onConflict: "user_id,key" });
    if (error) console.error("save error:", key, error);
  } catch(e) { console.error("save exception:", key, e); }
}

// ── Date utilities ─────────────────────────────────────────────────────────
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function fmt(s) { if (!s || isNaN(s)) return "--"; const m = Math.floor(s/60), sc = Math.round(s%60); return `${m}:${sc.toString().padStart(2,"0")}`; }
function toSecs(m, s) { return Number(m)*60 + Number(s); }
function fmtPace(s, plus=0) { return fmt(s) + (plus ? "–"+fmt(s+plus) : "") + "/mi"; }
function daysToRace() { const t = new Date(); t.setHours(0,0,0,0); return Math.ceil((RACE_DAY-t)/86400000); }
function dateDiffDays(a, b) { return Math.round((b-a)/86400000); }
function formatDate(date) { return date.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" }); }
function project10Mile(rpr) {
  if (!rpr) return "--";
  const t = rpr*2.5*Math.pow(10/2.5,1.06);
  const h=Math.floor(t/3600), m=Math.floor((t%3600)/60), s=Math.round(t%60);
  return h>0?`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${m}:${String(s).padStart(2,"0")}`;
}
function calcPaces(goalSecs) {
  const rp = goalSecs/2.5;
  return { racePace:fmtPace(rp), tempo:fmtPace(rp*0.975,8), easy:fmtPace(rp*1.22,20), long:fmtPace(rp*1.28,20), racePaceRaw:rp, goalSecs };
}
function calcFromMile(mileSecs) { const rp=mileSecs*1.055, gs=rp*2.5; return { ...calcPaces(gs), estimatedGoal:fmt(gs) }; }
function calcFromAvgPace(paceSecs) { return calcPaces(paceSecs*2.5); }

// ── Schedule builder ───────────────────────────────────────────────────────
function buildSchedule(daysPerWeek, startDate) {
  const dayMaps = { 3:[2,4,6], 4:[1,3,5,6], 5:[1,2,3,5,6] };
  const targetDays = dayMaps[daysPerWeek] || dayMaps[4];
  const schedule = [];
  let cursor = new Date(startDate); cursor.setHours(0,0,0,0);
  while (schedule.length < 45) {
    if (cursor >= RACE_DAY) break;
    if (targetDays.includes(cursor.getDay())) schedule.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  schedule.push(new Date(RACE_DAY));
  return schedule;
}

// ── Avatar data ────────────────────────────────────────────────────────────
const SKIN_TONES = ["#FDDBB4","#F5C89A","#E8A87C","#C68642","#8D5524","#4A2912"];
const JERSEY_COLORS = ["#c0392b","#2980b9","#27ae60","#8e44ad","#e67e22","#1abc9c","#2c3e50","#f39c12","#e91e63","#00bcd4"];
const SHORTS_COLORS = ["#2c3e50","#ffffff","#c0392b","#2980b9","#27ae60","#8e44ad","#e67e22","#f39c12","#333","#e91e63"];

// SVG avatar poses — 8 illustrated runners
function RunnerSVG({ pose=0, skin="#E8A87C", jersey="#c0392b", shorts="#2c3e50", size=60 }) {
  const poses = [
    // Pose 0: mid-stride left
    <g key={0}>
      <ellipse cx="30" cy="12" rx="8" ry="9" fill={skin}/>
      <rect x="20" y="22" width="20" height="18" rx="4" fill={jersey}/>
      <rect x="22" y="40" width="7" height="14" rx="3" fill={shorts}/>
      <rect x="31" y="40" width="7" height="14" rx="3" fill={shorts}/>
      <rect x="22" y="53" width="9" height="5" rx="2" fill="#333"/>
      <rect x="31" y="53" width="9" height="5" rx="2" fill="#333"/>
      <line x1="20" y1="28" x2="10" y2="38" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
      <line x1="40" y1="28" x2="48" y2="36" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
    </g>,
    // Pose 1: sprinting
    <g key={1}>
      <ellipse cx="30" cy="11" rx="8" ry="9" fill={skin}/>
      <rect x="20" y="21" width="20" height="17" rx="4" fill={jersey}/>
      <rect x="21" y="38" width="7" height="16" rx="3" fill={shorts} transform="rotate(-15,24,46)"/>
      <rect x="31" y="38" width="7" height="16" rx="3" fill={shorts} transform="rotate(10,34,46)"/>
      <rect x="18" y="52" width="10" height="5" rx="2" fill="#333" transform="rotate(-15,23,54)"/>
      <rect x="32" y="52" width="10" height="5" rx="2" fill="#333" transform="rotate(10,37,54)"/>
      <line x1="20" y1="27" x2="8" y2="34" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
      <line x1="40" y1="27" x2="50" y2="20" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
    </g>,
    // Pose 2: upright runner
    <g key={2}>
      <ellipse cx="30" cy="12" rx="8" ry="9" fill={skin}/>
      <rect x="21" y="22" width="18" height="18" rx="4" fill={jersey}/>
      <rect x="22" y="40" width="7" height="15" rx="3" fill={shorts}/>
      <rect x="31" y="40" width="7" height="15" rx="3" fill={shorts}/>
      <rect x="21" y="54" width="9" height="5" rx="2" fill="#333"/>
      <rect x="30" y="54" width="9" height="5" rx="2" fill="#333"/>
      <line x1="21" y1="28" x2="12" y2="36" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
      <line x1="39" y1="28" x2="48" y2="36" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
    </g>,
    // Pose 3: leaning forward
    <g key={3}>
      <ellipse cx="32" cy="11" rx="8" ry="9" fill={skin} transform="rotate(15,32,11)"/>
      <rect x="22" y="21" width="20" height="17" rx="4" fill={jersey} transform="rotate(10,32,29)"/>
      <rect x="22" y="38" width="7" height="15" rx="3" fill={shorts}/>
      <rect x="31" y="40" width="7" height="15" rx="3" fill={shorts}/>
      <rect x="20" y="52" width="10" height="5" rx="2" fill="#333"/>
      <rect x="31" y="53" width="10" height="5" rx="2" fill="#333"/>
      <line x1="22" y1="26" x2="10" y2="30" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
      <line x1="40" y1="24" x2="50" y2="30" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
    </g>,
    // Pose 4: arms up celebrating
    <g key={4}>
      <ellipse cx="30" cy="12" rx="8" ry="9" fill={skin}/>
      <rect x="21" y="22" width="18" height="18" rx="4" fill={jersey}/>
      <rect x="22" y="40" width="7" height="14" rx="3" fill={shorts}/>
      <rect x="31" y="40" width="7" height="14" rx="3" fill={shorts}/>
      <rect x="22" y="53" width="9" height="5" rx="2" fill="#333"/>
      <rect x="31" y="53" width="9" height="5" rx="2" fill="#333"/>
      <line x1="21" y1="26" x2="10" y2="14" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
      <line x1="39" y1="26" x2="50" y2="14" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
    </g>,
    // Pose 5: stride right
    <g key={5}>
      <ellipse cx="30" cy="12" rx="8" ry="9" fill={skin}/>
      <rect x="20" y="22" width="20" height="18" rx="4" fill={jersey}/>
      <rect x="21" y="40" width="7" height="14" rx="3" fill={shorts} transform="rotate(10,24,47)"/>
      <rect x="32" y="40" width="7" height="14" rx="3" fill={shorts} transform="rotate(-10,36,47)"/>
      <rect x="19" y="52" width="10" height="5" rx="2" fill="#333" transform="rotate(10,24,54)"/>
      <rect x="31" y="52" width="10" height="5" rx="2" fill="#333" transform="rotate(-10,36,54)"/>
      <line x1="20" y1="28" x2="12" y2="36" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
      <line x1="40" y1="28" x2="50" y2="38" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
    </g>,
    // Pose 6: relaxed jog
    <g key={6}>
      <ellipse cx="30" cy="13" rx="8" ry="9" fill={skin}/>
      <rect x="21" y="23" width="18" height="16" rx="4" fill={jersey}/>
      <rect x="22" y="39" width="7" height="15" rx="3" fill={shorts}/>
      <rect x="31" y="39" width="7" height="15" rx="3" fill={shorts}/>
      <rect x="22" y="53" width="9" height="5" rx="2" fill="#333"/>
      <rect x="31" y="53" width="9" height="5" rx="2" fill="#333"/>
      <line x1="21" y1="29" x2="14" y2="38" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
      <line x1="39" y1="29" x2="46" y2="38" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
    </g>,
    // Pose 7: race finish lean
    <g key={7}>
      <ellipse cx="31" cy="11" rx="8" ry="9" fill={skin} transform="rotate(8,31,11)"/>
      <rect x="21" y="21" width="20" height="17" rx="4" fill={jersey} transform="rotate(8,31,29)"/>
      <rect x="22" y="38" width="7" height="16" rx="3" fill={shorts} transform="rotate(-5,25,46)"/>
      <rect x="31" y="38" width="7" height="16" rx="3" fill={shorts} transform="rotate(15,34,46)"/>
      <rect x="20" y="52" width="10" height="5" rx="2" fill="#333"/>
      <rect x="32" y="51" width="10" height="5" rx="2" fill="#333" transform="rotate(15,37,53)"/>
      <line x1="21" y1="26" x2="9" y2="20" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
      <line x1="40" y1="25" x2="50" y2="32" stroke={skin} strokeWidth="4" strokeLinecap="round"/>
    </g>,
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="30" r="29" fill="#f0f0f0" stroke="#e0e0e0" strokeWidth="1"/>
      {poses[pose % poses.length]}
    </svg>
  );
}

function Avatar({ config, size=40 }) {
  if (!config) return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:"#e0e0e0",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size*0.4, color:"#aaa" }}>?</div>
  );
  return <RunnerSVG pose={config.pose} skin={config.skin} jersey={config.jersey} shorts={config.shorts} size={size}/>;
}

// ── Type colors ────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  Easy:         { bg:"#e8f5e9", text:"#2e7d32", border:"#a5d6a7" },
  Long:         { bg:"#e3f2fd", text:"#1565c0", border:"#90caf9" },
  Tempo:        { bg:"#fff3e0", text:"#b84800", border:"#ffcc80" },
  Intervals:    { bg:"#fce4ec", text:"#880e4f", border:"#f48fb1" },
  "Time Trial": { bg:"#ede7f6", text:"#4527a0", border:"#9575cd" },
  Shakeout:     { bg:"#f3e5f5", text:"#6a1b9a", border:"#ce93d8" },
  Rest:         { bg:"#f5f5f5", text:"#616161", border:"#e0e0e0" },
  Race:         { bg:dark,      text:"#fff",    border:dark },
};

const FEEL_OPTS = ["💀 Died", "😤 Hard", "😊 Good", "😎 Easy"];
const FEEL_COLS = ["#c0392b","#e67e22","#27ae60","#2980b9"];

// ── API call ───────────────────────────────────────────────────────────────
async function callClaude(prompt) {
  try {
    console.log("callClaude: firing API request");
    const res = await fetch("/api/generate-plan", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ prompt }),
    });
    console.log("callClaude: got response", res.status);
    const data = await res.json();
    console.log("callClaude: data", JSON.stringify(data).slice(0, 200));
    const text = data.text || "[]";
    const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
    console.log("callClaude: parsed", Array.isArray(parsed) ? parsed.length + " items" : typeof parsed);
    return parsed;
  } catch(e) {
    console.error("callClaude error:", e);
    return null;
  }
}

// ── Generate initial full plan ─────────────────────────────────────────────
async function generateInitialPlan({ name, paces, daysPerWeek, assessment, startDate }) {
  const schedule = buildSchedule(daysPerWeek, startDate || new Date());
  const today = new Date(); today.setHours(0,0,0,0);

  const scheduleText = scheduleToFill.map((d, i) => {
    const daysOut = dateDiffDays(today, d);
    const daysToRaceVal = dateDiffDays(d, RACE_DAY);
    const isRace = d.getTime() === RACE_DAY.getTime();
    return `Slot ${i+1}: ${formatDate(d)} (${daysOut===0?"TODAY":`in ${daysOut}d`}, ${daysToRaceVal}d to race)${isRace?" ← RACE DAY":""}`;
  }).join("\n");

  // Generate in two halves if too many slots
  const maxSlots = Math.min(schedule.length, 30);
  const scheduleToFill = schedule.slice(0, maxSlots);

  const prompt = `You are a running coach. Build a training plan for ${name} for a 2.5-mile race on Sep 11, 2026.

GOAL: finish in ${fmt(paces.goalSecs)} (${paces.racePace} pace)
TRAINING PACES: easy ${paces.easy} | tempo ${paces.tempo} | race pace ${paces.racePace} | long ${paces.long}
DAYS PER WEEK: ${daysPerWeek}
TOTAL SLOTS TO FILL: ${maxSlots}

RUNNER ASSESSMENT:
${assessment}

SCHEDULE SLOTS (assign one workout per slot):
${scheduleText}

BUILD A COMPLETE OPTIMISTIC PLAN assuming the runner will complete all workouts as prescribed. Progress through these phases:
- BASE (slots 1-${Math.round(maxSlots*0.25)}): Easy and Long runs only.
- VOLUME (slots ${Math.round(maxSlots*0.25)+1}-${Math.round(maxSlots*0.45)}): Add Tempo runs.
- SPEED (slots ${Math.round(maxSlots*0.45)+1}-${Math.round(maxSlots*0.75)}): Add Intervals.
- TAPER (last 4 slots): Reduce volume, keep sharpness.
- Final slot must be Race Day if Sep 11 is included, otherwise end with Taper.

Adjust phase lengths based on the runner's assessment. If they're experienced, compress Base. If beginner, extend Base.

Return ONLY a raw JSON array with exactly ${maxSlots} entries:
[{"id":"s1","scheduledDate":"2026-07-04","label":"Fri Jul 4","daysToRace":69,"type":"Easy","desc":"3 mi easy (${paces.easy})","phase":"Base","coachNote":"Starting with easy miles to build your aerobic base."}]`;

  const result = await callClaude(prompt);
  if (!result || !Array.isArray(result) || result.length < 5) return null;
  // Attach real dates from schedule
  return result.map((w, i) => ({
    ...w,
    scheduledDate: scheduleToFill[i] ? scheduleToFill[i].toISOString() : w.scheduledDate,
    daysToRace: scheduleToFill[i] ? dateDiffDays(scheduleToFill[i], RACE_DAY) : w.daysToRace,
    label: scheduleToFill[i] ? formatDate(scheduleToFill[i]) : w.label,
  }));
}

// ── Adjust plan after log ──────────────────────────────────────────────────
async function adjustPlan({ name, paces, history, remainingPlan }) {
  if (!remainingPlan || remainingPlan.length === 0) return remainingPlan;

  const recentHistory = history.slice(-6).map((h, i) => {
    const n = Math.max(1, history.length-6)+i+1;
    if (h.status==="skipped") return `#${n} [SKIPPED] ${h.type} on ${h.label}${h.skipReason?` — ${h.skipReason}`:""}`;
    if (h.status==="incomplete") return `#${n} [COULDN'T FINISH] ${h.type} on ${h.label} — stopped at ${h.stoppedAt||"unknown"}${h.notes?`, ${h.notes}`:""}`;
    return `#${n} [DONE] ${h.type} on ${h.label} — felt ${h.feel}${h.pace?`, actual pace: ${h.pace}`:""}${h.notes?`, ${h.notes}`:""}`;
  }).join("\n");

  const lastEntry = history[history.length-1];
  const needsAdjust = lastEntry?.status==="skipped" || lastEntry?.status==="incomplete" ||
    lastEntry?.feel==="💀 Died" || lastEntry?.feel==="\ud83d\ude24 Hard";

  if (!needsAdjust) return remainingPlan; // No adjustment needed

  const scheduleText = remainingPlan.map((w, i) =>
    `Slot ${i+1}: ${w.label} (${w.daysToRace}d to race) — currently: ${w.type} — ${w.desc}`
  ).join("\n");

  const prompt = `You are a running coach adjusting ${name}'s training plan based on recent performance.

PACES: easy ${paces.easy} | tempo ${paces.tempo} | race pace ${paces.racePace}
RACE: Sep 11, 2026 (${daysToRace()} days away)

RECENT HISTORY:
${recentHistory}

REMAINING PLAN TO ADJUST:
${scheduleText}

The runner is struggling (skipped, couldn't finish, or found workouts very hard). Adjust the remaining plan:
- Reduce intensity or volume as needed
- Don't change more than necessary
- Keep race day on Sep 11
- Return the same number of slots (${remainingPlan.length})

Return ONLY a raw JSON array with ${remainingPlan.length} entries using the same format:
[{"id":"s1","scheduledDate":"2026-07-10","label":"Fri Jul 10","daysToRace":63,"type":"Easy","desc":"2.5 mi easy (${paces.easy})","phase":"Base","coachNote":"Scaling back after a tough week."}]`;

  const result = await callClaude(prompt);
  if (!result || !Array.isArray(result) || result.length < 1) return remainingPlan;
  // Keep original dates, just update workout content
  return result.map((w, i) => ({
    ...w,
    scheduledDate: remainingPlan[i]?.scheduledDate || w.scheduledDate,
    daysToRace: remainingPlan[i]?.daysToRace || w.daysToRace,
    label: remainingPlan[i]?.label || w.label,
  }));
}

// ── Auth screen ────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(""); setLoading(true);
    try {
      if (mode==="signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Auto sign in after signup
        const { data, error: e2 } = await supabase.auth.signInWithPassword({ email, password });
        if (e2) throw e2;
        onAuth(data.user);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuth(data.user);
      }
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth:420, margin:"0 auto", padding:"48px 24px", background:"#f7f7f5", minHeight:"100vh" }}>
      <div style={{ fontSize:10, fontWeight:800, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.18em", marginBottom:8 }}>Race Training</div>
      <h1 style={{ fontSize:28, fontWeight:900, color:"#111", margin:"0 0 32px", letterSpacing:"-0.02em", lineHeight:1.1 }}>
        {mode==="login"?"Welcome back.":"Create your"}<br/>
        <span style={{ color:accent }}>{mode==="login"?"Log in to continue.":"account."}</span>
      </h1>
      {["email","password"].map(f => (
        <input key={f} type={f} value={f==="email"?email:password}
          onChange={e => f==="email"?setEmail(e.target.value):setPassword(e.target.value)}
          placeholder={f==="email"?"Email address":"Password"}
          style={{ width:"100%", padding:"12px 14px", fontSize:15, border:"1.5px solid #e0e0e0",
            borderRadius:10, color:"#111", background:"#fff", boxSizing:"border-box",
            fontFamily:"inherit", marginBottom:10 }}/>
      ))}
      {error && <div style={{ padding:"10px 12px", background:"#fce4ec", borderRadius:8, fontSize:13, color:accent, marginBottom:12 }}>{error}</div>}
      <button onClick={handleSubmit} disabled={loading||!email||!password}
        style={{ width:"100%", padding:"14px 0", borderRadius:10, border:"none",
          background:email&&password?accent:"#e0e0e0", color:"#fff", fontWeight:800, fontSize:15,
          cursor:email&&password?"pointer":"default", marginBottom:16 }}>
        {loading?"...":(mode==="login"?"Log in":"Create account")}
      </button>
      <div style={{ textAlign:"center", fontSize:13, color:"#aaa" }}>
        {mode==="login"?"No account? ":"Already have one? "}
        <button onClick={()=>{setMode(mode==="login"?"signup":"login");setError("");}}
          style={{ background:"none", border:"none", color:accent, fontWeight:700, fontSize:13, cursor:"pointer" }}>
          {mode==="login"?"Sign up":"Log in"}
        </button>
      </div>
    </div>
  );
}

// ── Avatar builder ─────────────────────────────────────────────────────────
function AvatarBuilder({ value, onChange }) {
  const config = value || { pose:0, skin:SKIN_TONES[2], jersey:JERSEY_COLORS[0], shorts:SHORTS_COLORS[0] };

  const swatch = (color, selected, onClick) => (
    <button key={color} onClick={()=>onClick(color)} style={{
      width:28, height:28, borderRadius:"50%", background:color, border:`3px solid ${selected?"#111":"transparent"}`,
      cursor:"pointer", outline:"none", flexShrink:0 }}/>
  );

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}>
        <RunnerSVG {...config} size={100}/>
      </div>

      {/* Pose picker */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Pose</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {[0,1,2,3,4,5,6,7].map(p => (
            <button key={p} onClick={()=>onChange({...config,pose:p})}
              style={{ padding:4, borderRadius:8, border:`2px solid ${config.pose===p?accent:"#e0e0e0"}`,
                background:config.pose===p?"#fff5f5":"#fff", cursor:"pointer" }}>
              <RunnerSVG {...config} pose={p} size={40}/>
            </button>
          ))}
        </div>
      </div>

      {/* Skin tone */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Skin tone</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {SKIN_TONES.map(c => swatch(c, config.skin===c, s=>onChange({...config,skin:s})))}
        </div>
      </div>

      {/* Jersey */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Jersey</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {JERSEY_COLORS.map(c => swatch(c, config.jersey===c, j=>onChange({...config,jersey:j})))}
        </div>
      </div>

      {/* Shorts */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Shorts</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {SHORTS_COLORS.map(c => swatch(c, config.shorts===c, s=>onChange({...config,shorts:s})))}
        </div>
      </div>
    </div>
  );
}

// ── Setup screen ───────────────────────────────────────────────────────────
function SetupScreen({ runnerSlot, onSave }) {
  const [step, setStep] = useState(1); // 1=pace, 2=assessment, 3=avatar
  const [name, setName] = useState("");
  const [paceMode, setPaceMode] = useState("goal"); // goal | mile | avgpace
  const [goalMin, setGoalMin] = useState(16); const [goalSec, setGoalSec] = useState(0);
  const [mileMin, setMileMin] = useState(7);  const [mileSec, setMileSec] = useState(0);
  const [paceMin, setPaceMin] = useState(7);  const [paceSec, setPaceSec] = useState(0);
  const [days, setDays] = useState(4);
  const [avatar, setAvatar] = useState({ pose:0, skin:SKIN_TONES[2], jersey:JERSEY_COLORS[0], shorts:SHORTS_COLORS[0] });
  const [assessment, setAssessment] = useState({
    level: "", weeklyMiles: "", longestRun: "", lastRace: "", injuries: "", notes: ""
  });

  const paces = paceMode==="goal" ? calcPaces(toSecs(goalMin,goalSec))
    : paceMode==="mile" ? calcFromMile(toSecs(mileMin,mileSec))
    : calcFromAvgPace(toSecs(paceMin,paceSec));

  const numInp = (v, set, min, max, label) => (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <input type="number" min={min} max={max} value={v} onChange={e=>set(e.target.value)}
        style={{ width:62, padding:"10px 6px", fontSize:22, fontWeight:800, textAlign:"center",
          border:"1.5px solid #e0e0e0", borderRadius:8, color:"#111", background:"#fff", fontFamily:"inherit" }}/>
      <span style={{ fontSize:10, color:"#aaa", fontWeight:700 }}>{label}</span>
    </div>
  );

  const handleSave = () => {
    const assessmentText = `Experience level: ${assessment.level}. Weekly miles: ${assessment.weeklyMiles}. Longest recent run: ${assessment.longestRun}. Last race: ${assessment.lastRace}. Injuries/limitations: ${assessment.injuries||"none"}. Additional notes: ${assessment.notes||"none"}.`;
    onSave({ name: name.trim()||runnerSlot, paces, daysPerWeek:days, avatar, assessmentText });
  };

  const aField = (key, label, placeholder) => (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6 }}>{label}</div>
      <input value={assessment[key]} onChange={e=>setAssessment({...assessment,[key]:e.target.value})}
        placeholder={placeholder}
        style={{ width:"100%", padding:"10px 12px", fontSize:14, border:"1.5px solid #e0e0e0",
          borderRadius:8, color:"#111", background:"#fff", boxSizing:"border-box", fontFamily:"inherit" }}/>
    </div>
  );

  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"32px 16px", background:"#f7f7f5", minHeight:"100vh" }}>
      <div style={{ fontSize:10, fontWeight:800, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.18em", marginBottom:8 }}>
        {runnerSlot} · Step {step} of 3
      </div>

      {/* Step indicator */}
      <div style={{ display:"flex", gap:6, marginBottom:24 }}>
        {[1,2,3].map(s => (
          <div key={s} style={{ flex:1, height:3, borderRadius:2,
            background:s<=step?accent:"#e0e0e0", transition:"background 0.3s" }}/>
        ))}
      </div>

      {step===1 && (
        <>
          <h1 style={{ fontSize:26, fontWeight:900, color:"#111", margin:"0 0 6px", letterSpacing:"-0.02em" }}>
            Set your <span style={{ color:accent }}>goal.</span>
          </h1>
          <p style={{ fontSize:13, color:"#aaa", marginBottom:20 }}>We'll build your full plan around this.</p>

          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Your name</div>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="First name"
              style={{ width:"100%", padding:"12px 14px", fontSize:15, fontWeight:600,
                border:"1.5px solid #e0e0e0", borderRadius:10, color:"#111", background:"#fff",
                boxSizing:"border-box", fontFamily:"inherit" }}/>
          </div>

          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Build from</div>
            <div style={{ display:"flex", gap:6 }}>
              {[["goal","Goal time"],["mile","Mile PR"],["avgpace","Avg pace"]].map(([m,l]) => (
                <button key={m} onClick={()=>setPaceMode(m)} style={{ flex:1, padding:"9px 4px", borderRadius:8,
                  border:`1.5px solid ${paceMode===m?accent:"#e0e0e0"}`,
                  background:paceMode===m?accent:"#fff", color:paceMode===m?"#fff":"#666",
                  fontWeight:700, fontSize:12, cursor:"pointer" }}>{l}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom:16, padding:16, background:"#fff", borderRadius:12, border:"1.5px solid #e0e0e0" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12 }}>
              {paceMode==="goal"?"2.5 mile goal time":paceMode==="mile"?"Mile PR":"Avg mile pace for race"}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {paceMode==="goal" && <>{numInp(goalMin,setGoalMin,10,45,"MIN")}<span style={{ fontSize:24, fontWeight:800, color:"#ddd", marginBottom:14 }}>:</span>{numInp(String(goalSec).padStart(2,"0"),setGoalSec,0,59,"SEC")}</>}
              {paceMode==="mile" && <>{numInp(mileMin,setMileMin,4,15,"MIN")}<span style={{ fontSize:24, fontWeight:800, color:"#ddd", marginBottom:14 }}>:</span>{numInp(String(mileSec).padStart(2,"0"),setMileSec,0,59,"SEC")}<div style={{ marginLeft:8, padding:"10px 14px", background:"#f7f7f5", borderRadius:8, border:"1.5px solid #e8e8e8" }}><div style={{ fontSize:10, color:"#aaa", fontWeight:700 }}>EST. GOAL</div><div style={{ fontSize:19, fontWeight:900, color:accent }}>{paces.estimatedGoal}</div></div></>}
              {paceMode==="avgpace" && <>{numInp(paceMin,setPaceMin,4,15,"MIN")}<span style={{ fontSize:24, fontWeight:800, color:"#ddd", marginBottom:14 }}>:</span>{numInp(String(paceSec).padStart(2,"0"),setPaceSec,0,59,"SEC")}<span style={{ fontSize:14, color:"#aaa", marginBottom:14, fontWeight:600 }}>/mi</span><div style={{ marginLeft:8, padding:"10px 14px", background:"#f7f7f5", borderRadius:8, border:"1.5px solid #e8e8e8" }}><div style={{ fontSize:10, color:"#aaa", fontWeight:700 }}>GOAL TIME</div><div style={{ fontSize:19, fontWeight:900, color:accent }}>{fmt(toSecs(paceMin,paceSec)*2.5)}</div></div></>}
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20 }}>
            {[["Race",paces.racePace,accent],["Tempo",paces.tempo,"#b84800"],["Easy",paces.easy,"#2e7d32"],["Long",paces.long,"#1565c0"]].map(([l,v,c]) => (
              <div key={l} style={{ padding:"10px 12px", background:"#fff", border:"1.5px solid #e8e8e8", borderRadius:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#bbb", textTransform:"uppercase", letterSpacing:"0.08em" }}>{l}</div>
                <div style={{ fontSize:14, fontWeight:800, color:c, marginTop:2 }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Days per week</div>
            <div style={{ display:"flex", gap:8 }}>
              {[3,4,5].map(d => (
                <button key={d} onClick={()=>setDays(d)} style={{ flex:1, padding:"12px 0", borderRadius:8,
                  border:`1.5px solid ${days===d?accent:"#e0e0e0"}`,
                  background:days===d?accent:"#fff", color:days===d?"#fff":"#666",
                  fontWeight:900, fontSize:20, cursor:"pointer" }}>{d}</button>
              ))}
            </div>
          </div>

          <button onClick={()=>setStep(2)}
            style={{ width:"100%", padding:"16px 0", borderRadius:12, border:"none",
              background:accent, color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer" }}>
            Next: Tell us about yourself →
          </button>
        </>
      )}

      {step===2 && (
        <>
          <h1 style={{ fontSize:26, fontWeight:900, color:"#111", margin:"0 0 6px", letterSpacing:"-0.02em" }}>
            Your <span style={{ color:accent }}>fitness background.</span>
          </h1>
          <p style={{ fontSize:13, color:"#aaa", marginBottom:20 }}>The coach uses this to build the right plan for you.</p>

          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Experience level</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {["Beginner","Casual","Intermediate","Advanced"].map(l => (
                <button key={l} onClick={()=>setAssessment({...assessment,level:l})} style={{
                  padding:"8px 14px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer",
                  border:`1.5px solid ${assessment.level===l?accent:"#e0e0e0"}`,
                  background:assessment.level===l?accent:"#fff",
                  color:assessment.level===l?"#fff":"#666" }}>{l}</button>
              ))}
            </div>
          </div>

          {aField("weeklyMiles","Current weekly mileage","e.g. 10-15 miles")}
          {aField("longestRun","Longest run in past month","e.g. 4 miles")}
          {aField("lastRace","Last race / recent PR","e.g. 5K in 24:00 two months ago")}
          {aField("injuries","Injuries or limitations","e.g. tight calves, none")}
          {aField("notes","Anything else the coach should know","e.g. I train best in mornings")}

          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <button onClick={()=>setStep(1)} style={{ flex:1, padding:"14px 0", borderRadius:10,
              border:"1.5px solid #e0e0e0", background:"#fff", color:"#aaa", fontWeight:700, fontSize:14, cursor:"pointer" }}>← Back</button>
            <button onClick={()=>setStep(3)} disabled={!assessment.level}
              style={{ flex:2, padding:"14px 0", borderRadius:10, border:"none",
                background:assessment.level?accent:"#e0e0e0", color:"#fff", fontWeight:800, fontSize:14, cursor:assessment.level?"pointer":"default" }}>
              Next: Pick your avatar →
            </button>
          </div>
        </>
      )}

      {step===3 && (
        <>
          <h1 style={{ fontSize:26, fontWeight:900, color:"#111", margin:"0 0 6px", letterSpacing:"-0.02em" }}>
            Your <span style={{ color:accent }}>avatar.</span>
          </h1>
          <p style={{ fontSize:13, color:"#aaa", marginBottom:20 }}>Shows up next to your name everywhere.</p>

          <AvatarBuilder value={avatar} onChange={setAvatar}/>

          <div style={{ display:"flex", gap:10, marginTop:20 }}>
            <button onClick={()=>setStep(2)} style={{ flex:1, padding:"14px 0", borderRadius:10,
              border:"1.5px solid #e0e0e0", background:"#fff", color:"#aaa", fontWeight:700, fontSize:14, cursor:"pointer" }}>← Back</button>
            <button onClick={handleSave}
              style={{ flex:2, padding:"14px 0", borderRadius:10, border:"none",
                background:accent, color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" }}>
              Build my plan →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Log modal ──────────────────────────────────────────────────────────────
function LogModal({ workout, paces, onSave, onClose }) {
  const [mode, setMode] = useState("completed");
  const [feel, setFeel] = useState(null);
  const [pace, setPace] = useState("");
  const [notes, setNotes] = useState("");
  const [stoppedAt, setStoppedAt] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const canSave = mode==="completed" ? !!feel : true;

  // Check if runner might want pace fine-tuning
  const fasterThanPrescribed = pace && feel && (feel.includes("Good")||feel.includes("Easy")) && (() => {
    try {
      const [m,s] = pace.replace("/mi","").trim().split(":").map(Number);
      const loggedPace = m*60+s;
      return loggedPace < paces?.racePaceRaw*0.98; // faster than race pace
    } catch { return false; }
  })();

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)",
      display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:100 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:"20px 20px 0 0",
        padding:"24px 20px 44px", width:"100%", maxWidth:480, maxHeight:"88vh", overflowY:"auto" }}>
        <div style={{ width:36, height:4, background:"#e0e0e0", borderRadius:2, margin:"0 auto 20px" }}/>
        <div style={{ fontSize:10, fontWeight:800, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:4 }}>Log workout</div>
        <div style={{ fontSize:17, fontWeight:800, color:"#111", marginBottom:4, lineHeight:1.3 }}>{workout.desc}</div>
        <div style={{ fontSize:12, color:"#aaa", marginBottom:20 }}>{workout.label} · {workout.daysToRace}d to race</div>

        <div style={{ display:"flex", gap:6, marginBottom:20 }}>
          {[["completed","\u2705 Done"],["incomplete","\u26a0\ufe0f Couldn't finish"],["skipped","\u23ed Skipped"]].map(([s,l]) => {
            const active = mode===s;
            const col = s==="completed"?"#27ae60":s==="incomplete"?"#e67e22":"#f57f17";
            return (
              <button key={s} onClick={()=>setMode(s)} style={{ flex:1, padding:"8px 4px", borderRadius:8,
                fontSize:11, fontWeight:700, cursor:"pointer",
                border:`1.5px solid ${active?col:"#e8e8e8"}`,
                background:active?col+"18":"#fff", color:active?col:"#999" }}>{l}</button>
            );
          })}
        </div>

        {mode==="completed" && (
          <>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#999", marginBottom:8 }}>How did it feel?</div>
              <div style={{ display:"flex", gap:6 }}>
                {FEEL_OPTS.map((f,i) => (
                  <button key={f} onClick={()=>setFeel(f)} style={{ flex:1, padding:"9px 4px", borderRadius:8,
                    fontSize:11, fontWeight:700, cursor:"pointer",
                    border:`1.5px solid ${feel===f?FEEL_COLS[i]:"#e8e8e8"}`,
                    background:feel===f?FEEL_COLS[i]:"#fff", color:feel===f?"#fff":"#888" }}>{f}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#999", marginBottom:8 }}>Actual pace (optional)</div>
              <input value={pace} onChange={e=>setPace(e.target.value)} placeholder="e.g. 7:15/mi"
                style={{ width:"100%", padding:"10px 12px", fontSize:14, border:"1.5px solid #e8e8e8",
                  borderRadius:8, boxSizing:"border-box", fontFamily:"inherit" }}/>
            </div>
            {fasterThanPrescribed && (
              <div style={{ marginBottom:16, padding:12, background:"#e8f5e9", borderRadius:10, border:"1.5px solid #a5d6a7" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#2e7d32", marginBottom:4 }}>
                  \u26a1 You're running faster than prescribed!
                </div>
                <div style={{ fontSize:12, color:"#388e3c" }}>
                  Want to fine-tune your paces based on today's performance? You can do this after saving.
                </div>
              </div>
            )}
          </>
        )}
        {mode==="incomplete" && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, padding:10, background:"#fff3e0", borderRadius:8, color:"#b84800", marginBottom:12, lineHeight:1.5 }}>The plan will adapt based on this.</div>
            <div style={{ fontSize:11, fontWeight:700, color:"#999", marginBottom:8 }}>Where did you stop?</div>
            <input value={stoppedAt} onChange={e=>setStoppedAt(e.target.value)} placeholder="e.g. after 2 reps, at 1.5 miles..."
              style={{ width:"100%", padding:"10px 12px", fontSize:14, border:"1.5px solid #e8e8e8", borderRadius:8, boxSizing:"border-box", fontFamily:"inherit" }}/>
          </div>
        )}
        {mode==="skipped" && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, padding:10, background:"#fff8e1", borderRadius:8, color:"#f57f17", marginBottom:12, lineHeight:1.5 }}>The plan will adapt around missed days.</div>
            <div style={{ fontSize:11, fontWeight:700, color:"#999", marginBottom:8 }}>Reason (optional)</div>
            <input value={skipReason} onChange={e=>setSkipReason(e.target.value)} placeholder="travel, sick, injury..."
              style={{ width:"100%", padding:"10px 12px", fontSize:14, border:"1.5px solid #e8e8e8", borderRadius:8, boxSizing:"border-box", fontFamily:"inherit" }}/>
          </div>
        )}

        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#999", marginBottom:8 }}>Notes (optional)</div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
            placeholder="Anything the coach should know..."
            style={{ width:"100%", padding:"10px 12px", fontSize:13, border:"1.5px solid #e8e8e8",
              borderRadius:8, resize:"none", boxSizing:"border-box", fontFamily:"inherit" }}/>
        </div>

        <button onClick={()=>canSave&&onSave({ status:mode, feel, pace, notes, stoppedAt, skipReason, suggestPaceTuning:fasterThanPrescribed })}
          disabled={!canSave} style={{ width:"100%", padding:"14px 0", borderRadius:10, border:"none",
            background:canSave?accent:"#e0e0e0", color:"#fff", fontWeight:800, fontSize:15,
            cursor:canSave?"pointer":"default" }}>
          Save & update plan
        </button>
      </div>
    </div>
  );
}

// ── Pace tuning modal ──────────────────────────────────────────────────────
function PaceTuningModal({ currentPaces, onAccept, onDismiss }) {
  // Suggest ~5% faster paces based on performance
  const newRaceRaw = currentPaces.racePaceRaw * 0.95;
  const newPaces = calcPaces(newRaceRaw * 2.5);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:16 }}>
      <div style={{ background:"#fff", borderRadius:16, padding:24, width:"100%", maxWidth:400 }}>
        <div style={{ fontSize:22, marginBottom:8 }}>\u26a1</div>
        <div style={{ fontSize:18, fontWeight:800, color:"#111", marginBottom:8 }}>Fine-tune your paces?</div>
        <div style={{ fontSize:13, color:"#666", marginBottom:20, lineHeight:1.6 }}>
          Based on your recent performance, your paces can be updated. This will rebuild your remaining plan.
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20 }}>
          {[["Race",currentPaces.racePace,newPaces.racePace,accent],["Tempo",currentPaces.tempo,newPaces.tempo,"#b84800"],["Easy",currentPaces.easy,newPaces.easy,"#2e7d32"]].map(([l,old_,new_,c]) => (
            <div key={l} style={{ padding:"10px 12px", background:"#f7f7f5", borderRadius:10, border:"1.5px solid #e8e8e8" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#bbb", textTransform:"uppercase" }}>{l}</div>
              <div style={{ fontSize:12, color:"#aaa", textDecoration:"line-through" }}>{old_}</div>
              <div style={{ fontSize:14, fontWeight:800, color:c }}>{new_}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onDismiss} style={{ flex:1, padding:"12px 0", borderRadius:10,
            border:"1.5px solid #e0e0e0", background:"#fff", color:"#aaa", fontWeight:700, fontSize:14, cursor:"pointer" }}>Keep current</button>
          <button onClick={()=>onAccept(newPaces)} style={{ flex:2, padding:"12px 0", borderRadius:10,
            border:"none", background:accent, color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" }}>Update paces</button>
        </div>
      </div>
    </div>
  );
}

// ── Next workout card ──────────────────────────────────────────────────────
function NextWorkoutCard({ workout, generating, onLog }) {
  if (generating) return (
    <div style={{ padding:20, background:"#fff", borderRadius:16, marginBottom:20,
      border:"1.5px solid #e8e8e8", textAlign:"center" }}>
      <div style={{ fontSize:13, color:"#aaa", fontStyle:"italic" }}>Coach is building your plan...</div>
    </div>
  );
  if (!workout) return (
    <div style={{ padding:24, background:dark, borderRadius:16, marginBottom:20, textAlign:"center" }}>
      <div style={{ fontSize:32, marginBottom:8 }}>\ud83c\udfc1</div>
      <div style={{ fontSize:18, fontWeight:800, color:"#fff" }}>Race day is here.</div>
      <div style={{ fontSize:13, color:"#666", marginTop:4 }}>Sep 11, 2026 — give everything.</div>
    </div>
  );
  const c = TYPE_COLORS[workout.type] || TYPE_COLORS.Easy;
  const isRace = workout.type==="Race";
  const today = new Date(); today.setHours(0,0,0,0);
  const workoutDate = workout.scheduledDate ? new Date(workout.scheduledDate) : null;
  workoutDate?.setHours(0,0,0,0);
  const isToday = workoutDate && workoutDate.getTime()===today.getTime();
  const isFuture = workoutDate && workoutDate > today;

  return (
    <div style={{ marginBottom:20, background:isRace?dark:"#fff", borderRadius:16,
      border:`2px solid ${isRace?dark:isToday?accent:"#e8e8e8"}`, overflow:"hidden" }}>
      <div style={{ padding:"16px 18px 0" }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:8 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:800, color:isRace?"#555":isToday?accent:"#aaa",
              textTransform:"uppercase", letterSpacing:"0.15em", marginBottom:2 }}>
              {isToday?"TODAY":isFuture?"NEXT UP":"UP NEXT"} · {workout.label}
            </div>
            {workout.daysToRace != null && (
              <div style={{ fontSize:11, color:isRace?"#444":"#bbb" }}>
                {workout.daysToRace===0?"Race day!":workout.daysToRace===1?"1 day to race":`${workout.daysToRace} days to race`}
              </div>
            )}
          </div>
          <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20,
            background:c.bg, color:c.text, border:`1px solid ${c.border}`, whiteSpace:"nowrap" }}>{workout.type}</span>
        </div>
        <div style={{ fontSize:19, fontWeight:900, color:isRace?"#fff":"#111", lineHeight:1.25, marginBottom:8 }}>{workout.desc}</div>
        {workout.phase && (
          <div style={{ fontSize:10, fontWeight:700, color:isRace?"#333":"#ccc",
            textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>{workout.phase}</div>
        )}
        {workout.coachNote && (
          <div style={{ fontSize:13, color:isRace?"#555":"#888", lineHeight:1.6,
            paddingTop:10, borderTop:`1px solid ${isRace?"#1a1a2e":"#f0f0f0"}`,
            fontStyle:"italic" }}>{workout.coachNote}</div>
        )}
      </div>
      {!isRace && (
        <button onClick={onLog} style={{ width:"100%", padding:"14px 18px", background:accent,
          border:"none", color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer",
          textAlign:"left", display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:16 }}>
          <span>Log this workout</span><span style={{ fontSize:20 }}>→</span>
        </button>
      )}
    </div>
  );
}

// ── Unified timeline ───────────────────────────────────────────────────────
function UnifiedTimeline({ history, plan }) {
  const [showAll, setShowAll] = useState(false);
  const feelColors = ["#c0392b","#e67e22","#27ae60","#2980b9"];
  const feelOpts = ["💀 Died", "😤 Hard", "😊 Good", "😎 Easy"];
  const statusIcon = s => s==="completed"?"\u2705":s==="skipped"?"\u23ed":"\u26a0\ufe0f";

  // Upcoming = everything after first item (shown in NextWorkoutCard)
  const upcoming = plan.slice(1);
  const upcomingShown = showAll ? upcoming : upcoming.slice(0, 6);

  return (
    <div style={{ marginBottom:20 }}>
      {/* Logged */}
      {history.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:8 }}>Logged</div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {[...history].reverse().map((h,i) => {
              const fi = feelOpts.indexOf(h.feel);
              return (
                <div key={i} style={{ padding:"10px 12px", background:"#fff", borderRadius:10, border:"1.5px solid #ebebeb" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <span style={{ fontSize:14 }}>{statusIcon(h.status)}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:"#aaa" }}>{h.label}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:"#111" }}>{h.type}</span>
                    {h.feel && <span style={{ fontSize:12, fontWeight:600, color:fi>=0?feelColors[fi]:"#888" }}>{h.feel}</span>}
                    {h.pace && <span style={{ fontSize:11, color:"#aaa" }}>\u00b7 {h.pace}</span>}
                    {h.daysToRace != null && <span style={{ fontSize:10, color:"#ccc", marginLeft:"auto" }}>{h.daysToRace}d to race</span>}
                  </div>
                  <div style={{ fontSize:12, color:"#aaa", marginTop:3, paddingLeft:22 }}>{h.desc}</div>
                  {(h.notes||h.skipReason||h.stoppedAt) && (
                    <div style={{ fontSize:12, color:"#999", marginTop:3, paddingLeft:22, fontStyle:"italic" }}>
                      {h.skipReason||h.stoppedAt||h.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <div style={{ fontSize:11, fontWeight:800, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:8 }}>Coming up</div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {upcomingShown.map((w,i) => {
              const c = TYPE_COLORS[w.type] || TYPE_COLORS.Easy;
              const isRace = w.type==="Race";
              return (
                <div key={w.id||i} style={{ display:"flex", alignItems:"flex-start", gap:8,
                  padding:"10px 12px", background:isRace?dark:"#fff", borderRadius:10,
                  border:`1.5px solid ${isRace?"#1a1a2e":"#ebebeb"}` }}>
                  <div style={{ minWidth:72, flexShrink:0 }}>
                    <div style={{ fontSize:10, fontWeight:800, color:isRace?"#555":"#bbb", lineHeight:1.3 }}>{w.label}</div>
                    {w.daysToRace != null && <div style={{ fontSize:9, color:isRace?"#444":"#ccc" }}>{w.daysToRace}d to race</div>}
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, padding:"2px 7px", borderRadius:20,
                    background:c.bg, color:c.text, border:`1px solid ${c.border}`,
                    whiteSpace:"nowrap", flexShrink:0, marginTop:1 }}>{w.type}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, color:isRace?"#bbb":"#444", lineHeight:1.4 }}>{w.desc}</div>
                    {w.phase && <div style={{ fontSize:9, fontWeight:700, color:isRace?"#333":"#ccc",
                      marginTop:2, textTransform:"uppercase", letterSpacing:"0.08em" }}>{w.phase}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {upcoming.length > 6 && (
            <button onClick={()=>setShowAll(s=>!s)} style={{ width:"100%", marginTop:8,
              padding:"10px 0", background:"none", border:"1.5px solid #e8e8e8", borderRadius:10,
              fontSize:12, fontWeight:700, color:"#aaa", cursor:"pointer" }}>
              {showAll?"Show less \u2191":`Show all ${upcoming.length} workouts \u2193`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Group panel ────────────────────────────────────────────────────────────
function GroupPanel({ currentName, allProfiles }) {
  const [tab, setTab] = useState("squad");
  const [counts, setCounts] = useState({});

  useEffect(() => {
    (async () => {
      const c = {};
      for (const n of RUNNERS) {
        const h = await load(`history-${n}`);
        c[n] = { total:h?.length||0, done:h?.filter(x=>x.status==="completed").length||0 };
      }
      setCounts(c);
    })();
  }, [currentName]);

  return (
    <div style={{ marginBottom:20, background:"#fff", borderRadius:12, border:"1.5px solid #e8e8e8", overflow:"hidden" }}>
      <div style={{ display:"flex", borderBottom:"1.5px solid #f0f0f0" }}>
        {[["squad","Squad"],["projection","10-Mile"]].map(([t,l]) => (
          <button key={t} onClick={()=>setTab(t)} style={{ flex:1, padding:"10px 0",
            fontSize:11, fontWeight:800, border:"none", cursor:"pointer",
            background:tab===t?"#fff":"#f7f7f5", color:tab===t?"#111":"#aaa",
            borderBottom:tab===t?`2px solid ${accent}`:"2px solid transparent" }}>{l}</button>
        ))}
      </div>
      <div style={{ padding:14 }}>
        {tab==="squad" && RUNNERS.map(slot => {
          const profile = allProfiles[slot];
          const c = counts[slot] || { total:0, done:0 };
          const isMe = slot===currentName;
          const pct = c.total>0 ? Math.round((c.done/c.total)*100) : 0;
          return (
            <div key={slot} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <Avatar config={profile?.avatar} size={28}/>
                <span style={{ fontSize:12, fontWeight:isMe?800:500, color:isMe?"#111":"#888", flex:1 }}>
                  {profile?.name || slot}{isMe?" (you)":""}
                </span>
                <span style={{ fontSize:11, fontWeight:700, color:isMe?accent:"#bbb" }}>{c.done} runs · {pct}%</span>
              </div>
              <div style={{ height:4, background:"#f0f0f0", borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct}%`, background:isMe?accent:"#ddd", borderRadius:2, transition:"width 0.4s" }}/>
              </div>
            </div>
          );
        })}
        {tab==="projection" && (
          <div>
            <div style={{ fontSize:11, color:"#aaa", marginBottom:12, lineHeight:1.5 }}>Projected 10-mile from goal pace (Riegel formula).</div>
            {RUNNERS.map(slot => {
              const profile = allProfiles[slot];
              const isMe = slot===currentName;
              if (!profile) return (
                <div key={slot} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, opacity:0.35 }}>
                  <Avatar config={null} size={28}/>
                  <span style={{ fontSize:13, color:"#aaa", flex:1 }}>{slot}</span>
                  <span style={{ fontSize:12, color:"#ccc" }}>Not set up</span>
                </div>
              );
              return (
                <div key={slot} style={{ marginBottom:10, padding:"10px 12px", borderRadius:8,
                  background:isMe?"#fff5f5":"#f7f7f5", border:`1.5px solid ${isMe?accent+"33":"#ebebeb"}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <Avatar config={profile.avatar} size={32}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:isMe?800:500, color:isMe?"#111":"#666" }}>
                        {profile.name||slot}{isMe?" \u2605":""}
                      </div>
                      <div style={{ fontSize:11, color:"#bbb" }}>Race pace: {profile.paces?.racePace}</div>
                    </div>
                    <span style={{ fontSize:19, fontWeight:900, color:isMe?accent:"#999" }}>
                      {project10Mile(profile.paces?.racePaceRaw)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Plan view ──────────────────────────────────────────────────────────────
function PlanView({ runner, currentSlot, allProfiles, onReset }) {
  const { name, paces, daysPerWeek, assessmentText, avatar } = runner;
  const [plan, setPlan] = useState([]);
  const [history, setHistory] = useState([]);
  const [logging, setLogging] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPaceTuning, setShowPaceTuning] = useState(false);
  const [currentPaces, setCurrentPaces] = useState(paces);
  const historyRef = useRef([]);

  useEffect(() => {
    (async () => {
      const h = await load(`history-${currentSlot}`) || [];
      const p = await load(`plan-${currentSlot}`) || [];
      setHistory(h);
      historyRef.current = h;
      setCurrentPaces(runner.paces);
      if (p.length > 0) {
        setPlan(p);
      } else {
        // Generate fresh plan
        setGenerating(true);
        const startDate = new Date().toISOString();
        await save(`planStart-${currentSlot}`, startDate);
        const newPlan = await generateInitialPlan({ name, paces, daysPerWeek, assessment:assessmentText, startDate });
        console.log("generateInitialPlan result:", newPlan ? newPlan.length + " workouts" : "null/empty");
        if (newPlan && newPlan.length > 0) {
          setPlan(newPlan);
          await save(`plan-${currentSlot}`, newPlan);
          console.log("plan saved");
        } else {
          console.error("plan generation returned empty:", newPlan);
        }
        setGenerating(false);
      }
    })();
  }, [currentSlot]);

  // Find next workout (today or nearest future)
  const today = new Date(); today.setHours(0,0,0,0);
  const nextWorkout = plan.find(w => {
    if (!w.scheduledDate) return true;
    const d = new Date(w.scheduledDate); d.setHours(0,0,0,0);
    return d >= today;
  }) || plan[0] || null;

  const handleLog = async (data) => {
    const workout = nextWorkout;
    if (!workout) return;

    const entry = {
      ...data,
      type: workout.type,
      desc: workout.desc,
      label: workout.label,
      scheduledDate: workout.scheduledDate,
      daysToRace: workout.daysToRace,
      loggedAt: new Date().toISOString(),
    };

    const newHistory = [...history, entry];
    setHistory(newHistory);
    historyRef.current = newHistory;
    setLogging(false);
    await save(`history-${currentSlot}`, newHistory);

    // Show pace tuning prompt if applicable
    if (data.suggestPaceTuning) {
      setShowPaceTuning(true);
    }

    // Find logged workout index in plan and get remaining
    const loggedIdx = plan.findIndex(w => w.scheduledDate === workout.scheduledDate);
    const remainingPlan = plan.slice(loggedIdx + 1);

    // Adjust plan if needed (skipped/incomplete/hard)
    const needsAdjust = data.status==="skipped" || data.status==="incomplete" ||
      data.feel==="💀 Died" || data.feel==="\ud83d\ude24 Hard";

    if (needsAdjust && remainingPlan.length > 0) {
      setGenerating(true);
      const adjusted = await adjustPlan({ name, paces:currentPaces, history:newHistory, remainingPlan });
      const newPlan = [...plan.slice(0, loggedIdx+1), ...adjusted];
      setPlan(newPlan);
      await save(`plan-${currentSlot}`, newPlan);
      setGenerating(false);
    }
  };

  const handlePaceAccept = async (newPaces) => {
    setCurrentPaces(newPaces);
    setShowPaceTuning(false);
    // Update profile
    const updatedRunner = { ...runner, paces: newPaces };
    await save(`profile-${currentSlot}`, updatedRunner);
    // Rebuild remaining plan with new paces
    const loggedIdx = plan.findIndex(w => {
      const d = new Date(w.scheduledDate); d.setHours(0,0,0,0);
      return d >= today;
    });
    const donePlan = plan.slice(0, loggedIdx);
    const remainingPlan = plan.slice(loggedIdx);
    setGenerating(true);
    const adjusted = await adjustPlan({ name, paces:newPaces, history:historyRef.current, remainingPlan });
    const newPlan = [...donePlan, ...adjusted];
    setPlan(newPlan);
    await save(`plan-${currentSlot}`, newPlan);
    setGenerating(false);
  };

  const completedCount = history.filter(h=>h.status==="completed").length;
  const totalLogged = history.length;
  const pct = totalLogged>0 ? Math.round((completedCount/totalLogged)*100) : 0;

  return (
    <div style={{ maxWidth:520, margin:"0 auto", padding:"24px 16px 48px", background:"#f7f7f5", minHeight:"100vh" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <Avatar config={avatar} size={48}/>
          <div>
            <div style={{ fontSize:10, fontWeight:800, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.15em" }}>Sep 11, 2026</div>
            <div style={{ fontSize:22, fontWeight:900, color:"#111", letterSpacing:"-0.02em" }}>{name}</div>
            <div style={{ fontSize:11, color:"#aaa" }}>{currentPaces.racePace} goal</div>
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:32, fontWeight:900, color:accent, lineHeight:1 }}>{daysToRace()}</div>
          <div style={{ fontSize:10, fontWeight:700, color:"#aaa" }}>DAYS LEFT</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:20 }}>
        {[["Done",completedCount,"#27ae60"],["Completion",`${pct}%`,pct>=60?accent:"#e67e22"],["Remaining",plan.filter(w=>w.type!=="Race").length,"#1565c0"]].map(([l,v,c]) => (
          <div key={l} style={{ padding:"10px 12px", background:"#fff", borderRadius:10, border:"1.5px solid #ebebeb", textAlign:"center" }}>
            <div style={{ fontSize:20, fontWeight:900, color:c }}>{v}</div>
            <div style={{ fontSize:10, fontWeight:700, color:"#bbb", textTransform:"uppercase", letterSpacing:"0.08em", marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Generating */}
      {generating && (
        <div style={{ marginBottom:16, padding:"12px 16px", background:"#fff", borderRadius:10,
          border:"1.5px solid #e8e8e8", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:accent }}/>
          <span style={{ fontSize:13, color:"#888", fontWeight:600 }}>Coach is updating your plan...</span>
        </div>
      )}

      <NextWorkoutCard workout={nextWorkout} generating={generating} onLog={()=>setLogging(true)}/>
      <GroupPanel currentName={currentSlot} allProfiles={allProfiles}/>
      <UnifiedTimeline history={history} plan={plan}/>

      {/* Paces */}
      <div style={{ marginBottom:20, padding:"12px 14px", background:"#fff", borderRadius:10, border:"1.5px solid #ebebeb" }}>
        <div style={{ fontSize:10, fontWeight:800, color:"#bbb", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Your paces</div>
        <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
          {[["Race",currentPaces.racePace,accent],["Tempo",currentPaces.tempo,"#b84800"],["Easy",currentPaces.easy,"#2e7d32"],["Long",currentPaces.long,"#1565c0"]].map(([l,v,c]) => (
            <div key={l}>
              <div style={{ fontSize:10, color:"#ccc", fontWeight:700 }}>{l}</div>
              <div style={{ fontSize:13, fontWeight:800, color:c }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onReset} style={{ width:"100%", padding:"12px 0", borderRadius:10,
        border:"1.5px solid #e0e0e0", background:"#fff", color:"#bbb", fontSize:13, fontWeight:600, cursor:"pointer" }}>
        ← Switch runner
      </button>

      {logging && nextWorkout && (
        <LogModal workout={nextWorkout} paces={currentPaces} onSave={handleLog} onClose={()=>setLogging(false)}/>
      )}
      {showPaceTuning && (
        <PaceTuningModal currentPaces={currentPaces} onAccept={handlePaceAccept} onDismiss={()=>setShowPaceTuning(false)}/>
      )}
    </div>
  );
}

// ── Runner select ──────────────────────────────────────────────────────────
function RunnerSelect({ onSelect }) {
  const [profiles, setProfiles] = useState({});
  const [stats, setStats] = useState({});

  useEffect(() => {
    (async () => {
      const p = {}, s = {};
      for (const n of RUNNERS) {
        const profile = await load(`profile-${n}`);
        if (profile) p[n] = profile;
        const hist = await load(`history-${n}`) || [];
        s[n] = { done:hist.filter(h=>h.status==="completed").length, total:hist.length };
      }
      setProfiles(p); setStats(s);
    })();
  }, []);

  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"32px 16px", background:"#f7f7f5", minHeight:"100vh" }}>
      <div style={{ fontSize:10, fontWeight:800, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.18em", marginBottom:8 }}>Sep 11, 2026</div>
      <h1 style={{ fontSize:28, fontWeight:900, color:"#111", margin:"0 0 4px", letterSpacing:"-0.02em", lineHeight:1.1 }}>
        Who's running<br/><span style={{ color:accent }}>today?</span>
      </h1>
      <div style={{ fontSize:13, color:"#aaa", marginBottom:28 }}>{daysToRace()} days to race day.</div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {RUNNERS.map(slot => {
          const profile = profiles[slot];
          const s = stats[slot] || { done:0, total:0 };
          const pct = s.total>0 ? Math.round((s.done/s.total)*100) : null;
          return (
            <button key={slot} onClick={()=>onSelect(slot, profile, profiles)}
              style={{ padding:"14px 16px", borderRadius:12, border:"1.5px solid #e4e4e4",
                background:"#fff", textAlign:"left", cursor:"pointer",
                display:"flex", alignItems:"center", gap:12 }}>
              <Avatar config={profile?.avatar} size={44}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:800, fontSize:16, color:"#111" }}>{profile?.name || slot}</div>
                {profile ? (
                  <>
                    <div style={{ fontSize:12, color:"#aaa", marginTop:1 }}>
                      Goal: {profile.paces?.racePace} · {profile.daysPerWeek} days/wk
                    </div>
                    {s.total>0 && (
                      <div style={{ marginTop:6 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <span style={{ fontSize:11, color:"#bbb" }}>{s.done} of {s.total} logged</span>
                          <span style={{ fontSize:11, fontWeight:700, color:pct>=60?accent:"#e67e22" }}>{pct}%</span>
                        </div>
                        <div style={{ height:3, background:"#f0f0f0", borderRadius:2 }}>
                          <div style={{ height:"100%", width:`${pct}%`, background:pct>=60?accent:"#e67e22", borderRadius:2 }}/>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize:12, color:"#ccc", marginTop:1 }}>Tap to set up</div>
                )}
              </div>
              <span style={{ fontSize:22, color:"#ddd" }}>›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(undefined);
  const [screen, setScreen] = useState("select");
  const [currentSlot, setCurrentSlot] = useState(null);
  const slotRef = useRef(null);
  const [runner, setRunner] = useState(null);
  const [allProfiles, setAllProfiles] = useState({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session) { setScreen("select"); setRunner(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSelect = (slot, profile, profiles) => {
    slotRef.current = slot;
    setCurrentSlot(slot);
    setAllProfiles(profiles || {});
    if (profile) { setRunner(profile); setScreen("plan"); }
    else setScreen("setup");
  };

  const handleSetup = async (data) => {
    const slot = slotRef.current;
    const profile = { ...data };
    await save(`profile-${slot}`, profile);
    setRunner(profile);
    setScreen("plan");
  };

  const handleReset = () => { setRunner(null); setCurrentSlot(null); slotRef.current = null; setScreen("select"); };
  const handleSignOut = async () => { await supabase.auth.signOut(); handleReset(); };

  if (user===undefined) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#f7f7f5" }}>
      <div style={{ fontSize:13, color:"#aaa" }}>Loading...</div>
    </div>
  );
  if (!user) return <AuthScreen onAuth={setUser}/>;

  return (
    <div>
      {screen==="select" && (
        <div style={{ position:"relative" }}>
          <button onClick={handleSignOut} style={{ position:"absolute", top:24, right:16,
            background:"none", border:"none", fontSize:12, color:"#ccc", cursor:"pointer", fontFamily:"inherit" }}>Sign out</button>
          <RunnerSelect onSelect={handleSelect}/>
        </div>
      )}
      {screen==="setup" && <SetupScreen runnerSlot={currentSlot} onSave={handleSetup}/>}
      {screen==="plan" && runner && currentSlot && (
        <PlanView runner={runner} currentSlot={currentSlot} allProfiles={allProfiles} onReset={handleReset}/>
      )}
    </div>
  );
}
