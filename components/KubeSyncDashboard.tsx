"use client";

import React, { useMemo, useState } from "react";

type Card = {
  id: string;
  name: string;
  connected: boolean;
  batteryPct: number; // 0..100
  health: {
    signal: number; // 0..100
    tempC: number;
    lastSyncMinsAgo: number;
  };
  inventory: { label: string; count: number }[];
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function BatteryBar({ pct }: { pct: number }) {
  const safe = clamp(pct, 0, 100);
  const level = safe >= 70 ? "high" : safe >= 35 ? "mid" : "low";
  const fillClass =
    level === "high" ? "bg-emerald-300" : level === "mid" ? "bg-amber-300" : "bg-rose-400";

  return (
    <div className="rounded-2xl border border-white/10 bg-[#161B2E] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[#E8ECFF] font-black">Battery</span>
        </div>
        <span className="text-[#E8ECFF] font-extrabold text-sm tabular-nums">{safe}%</span>
      </div>

      <div className="mt-3 h-3 w-full overflow-hidden rounded-full border border-white/10 bg-white/5">
        <div className={`h-full ${fillClass}`} style={{ width: `${safe}%` }} />
      </div>

      <p className="mt-3 text-[#A8B0D6] text-sm">
        {safe >= 35 ? "Charging steady." : "Low power — consider topping up."}
      </p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#E8ECFF] font-extrabold">{label}</span>
      <span className="text-[#E8ECFF] font-black tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Minimal Web NFC hook.
 * Works on Android Chrome/Edge in secure contexts only.
 */
function useWebNfc() {
  const [supported, setSupported] = useState<boolean>(false);
  const [scanning, setScanning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  React.useEffect(() => {
    // @ts-expect-error - NDEFReader is not in TS lib by default
    setSupported(typeof window !== "undefined" && "NDEFReader" in window);
  }, []);

  const push = (msg: string) => setLogs((p) => [`${new Date().toLocaleTimeString()}  ${msg}`, ...p]);

  const startScan = async () => {
    try {
      // @ts-expect-error
      const reader = new window.NDEFReader();
      setScanning(true);
      push("Starting scan… (tap an NFC tag)");

      await reader.scan();

      reader.onreadingerror = () => push("Read error (try again).");
      reader.onreading = (event: any) => {
        const serial = event?.serialNumber ? `serial=${event.serialNumber}` : "serial=unknown";
        push(`Tag read ✅ (${serial})`);

        // Try to decode first record if it’s a text record
        const record = event.message?.records?.[0];
        if (record?.recordType === "text") {
          try {
            const textDecoder = new TextDecoder(record.encoding || "utf-8");
            const text = textDecoder.decode(record.data);
            push(`Text record: "${text}"`);
          } catch {
            push("Text record found, but couldn’t decode.");
          }
        }
      };
    } catch (e: any) {
      setScanning(false);
      push(`Scan failed: ${e?.message ?? String(e)}`);
    }
  };

  const stopScan = () => {
    // Web NFC doesn’t expose a reliable stop() across browsers yet.
    // Best practice is: reload page / navigate away, or gate scans behind UI.
    setScanning(false);
    push("Stopped (UI-only). If the device keeps scanning, refresh the page.");
  };

  const writeText = async (text: string) => {
    try {
      // @ts-expect-error
      const writer = new window.NDEFReader();
      push(`Writing… "${text}" (tap a tag)`);
      await writer.write({ records: [{ recordType: "text", data: text }] });
      push("Write success ✅");
    } catch (e: any) {
      push(`Write failed: ${e?.message ?? String(e)}`);
    }
  };

  return { supported, scanning, logs, startScan, stopScan, writeText };
}

function LinkMenuModal({
  open,
  onClose,
  cardName,
  isConnected,
  onConnect,
  onDisconnect,
  onMonitor,
}: {
  open: boolean;
  onClose: () => void;
  cardName: string;
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onMonitor: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/15 bg-[#161B2E] p-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[#E8ECFF] text-lg font-black">Link Menu</h2>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[#E8ECFF] font-extrabold"
          >
            ✕
          </button>
        </div>

        <p className="mt-2 text-[#A8B0D6] text-sm">
          Manage <span className="text-[#E8ECFF] font-extrabold">{cardName}</span>: connect, disconnect, or check health.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => {
              if (!isConnected) onConnect();
              onClose();
            }}
            className="rounded-2xl border border-emerald-300/40 bg-emerald-300/15 py-3 font-black text-[#E8ECFF]"
          >
            Connect
          </button>

          <button
            onClick={() => {
              if (isConnected) onDisconnect();
              onClose();
            }}
            className="rounded-2xl border border-white/15 bg-white/5 py-3 font-black text-[#E8ECFF]"
          >
            Disconnect
          </button>

          <button
            onClick={() => {
              onMonitor();
              onClose();
            }}
            className="rounded-2xl border border-white/15 bg-white/5 py-3 font-black text-[#E8ECFF]"
          >
            Monitor Health
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-[#12172A] p-3">
          <div className="text-[#E8ECFF] font-black">Wire-up points</div>
          <div className="mt-2 text-[#A8B0D6] text-sm leading-5">
            • Connect → BLE/NFC session start<br />
            • Disconnect → session stop<br />
            • Monitor → read RSSI, temp, battery, last sync timestamp
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KubeSyncDashboard() {
  const initialCards: Card[] = useMemo(
    () => [
      {
        id: "card-1",
        name: "Card 1",
        connected: true,
        batteryPct: 76,
        health: { signal: 88, tempC: 33.1, lastSyncMinsAgo: 2 },
        inventory: [
          { label: "NFC Tags", count: 12 },
          { label: "Kube Notes", count: 3 },
          { label: "Sync Tokens", count: 7 },
        ],
      },
      {
        id: "card-2",
        name: "Card 2",
        connected: false,
        batteryPct: 42,
        health: { signal: 64, tempC: 35.4, lastSyncMinsAgo: 58 },
        inventory: [
          { label: "NFC Tags", count: 4 },
          { label: "Kube Notes", count: 1 },
          { label: "Sync Tokens", count: 2 },
        ],
      },
      {
        id: "card-3",
        name: "Card 3",
        connected: false,
        batteryPct: 18,
        health: { signal: 40, tempC: 37.8, lastSyncMinsAgo: 210 },
        inventory: [
          { label: "NFC Tags", count: 0 },
          { label: "Kube Notes", count: 9 },
          { label: "Sync Tokens", count: 0 },
        ],
      },
    ],
    []
  );

  const [cards, setCards] = useState<Card[]>(initialCards);
  const [selectedId, setSelectedId] = useState(cards[0]?.id ?? "");
  const [modalOpen, setModalOpen] = useState(false);

  const selected = useMemo(
    () => cards.find((c) => c.id === selectedId) ?? cards[0],
    [cards, selectedId]
  );

  const toggleConnection = () => {
    if (!selected) return;
    setCards((prev) => prev.map((c) => (c.id === selected.id ? { ...c, connected: !c.connected } : c)));
  };

  const statusLabel = selected?.connected ? "Connected" : "Disconnected";

  // NFC
  const nfc = useWebNfc();
  const [writeTextValue, setWriteTextValue] = useState(`KubeSync ping: ${new Date().toISOString()}`);

  if (!selected) return null;

  return (
    <div className="min-h-screen bg-[#0E1220] text-white">
      <div className="mx-auto flex max-w-6xl">
        {/* Left rail */}
        <aside className="w-[160px] border-r border-white/10 bg-[#0B0F1C] p-3">
          <div className="px-2 pb-3">
            <div className="text-[#E8ECFF] text-lg font-black">KubeSync</div>
            <div className="text-[#A8B0D6] text-xs font-bold">Companion Center</div>
          </div>

          <div className="flex flex-col gap-2 px-1">
            {cards.map((c) => {
              const isSel = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={[
                    "rounded-2xl border px-3 py-3 text-left transition",
                    isSel ? "border-white/20 bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/7",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <span className={isSel ? "text-[#E8ECFF]" : "text-[#A8B0D6]"}>⬢</span>
                    <span
                      className={[
                        "h-2 w-2 rounded-full",
                        c.connected ? "bg-emerald-300" : "bg-white/20",
                      ].join(" ")}
                      aria-label={c.connected ? "connected" : "disconnected"}
                    />
                  </div>
                  <div className={["mt-2 text-xs font-extrabold", isSel ? "text-[#E8ECFF]" : "text-[#A8B0D6]"].join(" ")}>
                    {c.name}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-2 px-1">
            <button
              onClick={() => setModalOpen(true)}
              className="rounded-xl border border-white/15 bg-white/10 py-2 text-xs font-black text-[#E8ECFF]"
            >
              ✦ Actions
            </button>
            <button
              onClick={() => alert("Settings placeholder")}
              className="rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-black text-[#E8ECFF]"
            >
              ⚙ Settings
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-4">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-black text-[#E8ECFF]">{selected.name}</div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-black",
                    selected.connected ? "border-emerald-300/40 bg-emerald-300/15" : "border-white/15 bg-white/5",
                  ].join(" ")}
                >
                  {statusLabel}
                </span>
                <span className="text-[#A8B0D6] text-xs font-bold">
                  Last sync: {selected.health.lastSyncMinsAgo}m ago
                </span>
              </div>
            </div>

            <button
              onClick={() => setModalOpen(true)}
              className="rounded-2xl border border-white/10 bg-[#161B2E] px-4 py-3 text-sm font-black text-[#E8ECFF]"
            >
              ⟷ Open Link Menu
            </button>
          </div>

          <BatteryBar pct={selected.batteryPct} />

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {/* Inventory */}
            <section className="rounded-2xl border border-white/10 bg-[#161B2E] p-4">
              <div className="flex items-center justify-between">
                <div className="text-[#E8ECFF] font-black">Inventory</div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black text-[#A8B0D6]">
                  Kube Pack
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-[#12172A] p-3">
                <div className="flex flex-col gap-2">
                  {selected.inventory.map((it) => (
                    <div key={it.label} className="flex items-center justify-between">
                      <span className="text-[#E8ECFF] font-extrabold">{it.label}</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-black text-[#E8ECFF] tabular-nums">
                        {it.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-3 text-[#A8B0D6] text-sm">
                Tip: inventory can represent synced artifacts (tags, notes, tokens, etc.).
              </p>
            </section>

            {/* Health Center */}
            <section className="rounded-2xl border border-white/10 bg-[#161B2E] p-4">
              <div className="flex items-center justify-between">
                <div className="text-[#E8ECFF] font-black">Health Center</div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black text-[#A8B0D6]">
                  Monitor
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-[#12172A] p-3 space-y-2">
                <StatRow label="Signal" value={`${selected.health.signal}/100`} />
                <StatRow label="Temp" value={`${selected.health.tempC.toFixed(1)}°C`} />
                <StatRow label="Status" value={statusLabel} />
              </div>

              <button
                onClick={() => setModalOpen(true)}
                className="mt-3 w-full rounded-2xl border border-white/15 bg-white/10 py-3 font-black text-[#E8ECFF]"
              >
                ♥ Run Quick Check
              </button>
            </section>
          </div>

          {/* NFC Panel */}
          <section className="mt-4 rounded-2xl border border-white/10 bg-[#161B2E] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[#E8ECFF] font-black">NFC Lab</div>
                <div className="text-[#A8B0D6] text-sm font-bold">
                  Web NFC: Android Chrome/Edge only • HTTPS/localhost required
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-black",
                    nfc.supported ? "border-emerald-300/40 bg-emerald-300/15" : "border-rose-300/40 bg-rose-300/15",
                  ].join(" ")}
                >
                  {nfc.supported ? "Supported" : "Not supported"}
                </span>
                <span className="text-[#A8B0D6] text-xs font-bold">{nfc.scanning ? "Scanning…" : "Idle"}</span>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 md:flex-row">
              <button
                disabled={!nfc.supported}
                onClick={nfc.startScan}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 font-black text-[#E8ECFF] disabled:opacity-40"
              >
                Start Scan
              </button>
              <button
                onClick={nfc.stopScan}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black text-[#E8ECFF]"
              >
                Stop (UI)
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
              <input
                value={writeTextValue}
                onChange={(e) => setWriteTextValue(e.target.value)}
                className="flex-1 rounded-2xl border border-white/10 bg-[#12172A] px-4 py-3 text-sm font-bold text-[#E8ECFF] outline-none"
                placeholder="Text to write to tag…"
              />
              <button
                disabled={!nfc.supported || !writeTextValue.trim()}
                onClick={() => nfc.writeText(writeTextValue.trim())}
                className="rounded-2xl border border-emerald-300/40 bg-emerald-300/15 px-4 py-3 font-black text-[#E8ECFF] disabled:opacity-40"
              >
                Write Text
              </button>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-[#12172A] p-3">
              <div className="text-[#E8ECFF] font-black text-sm">Logs</div>
              <div className="mt-2 max-h-48 overflow-auto text-xs text-[#A8B0D6] space-y-1">
                {nfc.logs.length === 0 ? (
                  <div>No events yet. Tap “Start Scan” then tap a tag.</div>
                ) : (
                  nfc.logs.map((l, i) => <div key={i}>{l}</div>)
                )}
              </div>
            </div>
          </section>

          {/* Dex strip */}
          <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[#E8ECFF] font-black">Kube Log</div>
                <p className="mt-2 text-[#A8B0D6] text-sm leading-5">
                  Choose a card on the left, then manage connection + health here. This layout is ready to wire into BLE/NFC events.
                </p>
              </div>
              <div className="text-right">
                <div className="text-[#E8ECFF] font-black">▦</div>
                <div className="mt-2 text-[#A8B0D6] text-sm font-black">v0.1 UI</div>
              </div>
            </div>
          </section>
        </main>
      </div>

      <LinkMenuModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        cardName={selected.name}
        isConnected={selected.connected}
        onConnect={toggleConnection}
        onDisconnect={toggleConnection}
        onMonitor={() => {
          setCards((prev) =>
            prev.map((c) =>
              c.id === selected.id
                ? {
                    ...c,
                    health: {
                      ...c.health,
                      signal: clamp(c.health.signal + 4, 0, 100),
                      tempC: c.health.tempC + 0.1,
                      lastSyncMinsAgo: 0,
                    },
                  }
                : c
            )
          );
        }}
      />
    </div>
  );
}
