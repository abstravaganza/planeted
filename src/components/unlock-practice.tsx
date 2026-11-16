"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";
export function UnlockPractice() {
  const router = useRouter();
  const [code,setCode]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent) {
    e.preventDefault(); if(busy)return;
    setBusy(true);setError("");
    try {
      const r=await fetch("/api/access",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})});
      const value=await r.json();
      if(!r.ok) throw new Error(value.error || "Could not open practice. Try again.");
      router.replace("/");
      router.refresh();
    } catch(e) { setError(e instanceof Error?e.message:"Could not open practice. Try again.");setBusy(false); }
  }
  return <main className="q-access-page"><form className="q-panel" onSubmit={e=>void submit(e)}>
    <span className="q-eyebrow">RUSSIAN WRITING QUEST</span><h1>Open practice</h1>
    <label htmlFor="practice-code">Family practice code</label>
    <input id="practice-code" type="password" autoComplete="current-password" value={code} maxLength={200} onChange={e=>setCode(e.target.value)} required aria-describedby={error?"access-error":undefined}/>
    {error&&<p id="access-error" role="alert">{error}</p>}
    <Button disabled={busy||!code.trim()}>{busy?"Opening…":"Let’s practice →"}</Button>
  </form></main>;
}
