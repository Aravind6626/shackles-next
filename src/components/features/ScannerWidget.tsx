"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";

type FeedbackState = {
  type: "success" | "warning" | "error" | "idle";
  message: string;
};

export default function ScannerWidget({ eventId, stationId = "WEB_SCANNER" }: { eventId?: string; stationId?: string }) {
  const [operationType, setOperationType] = useState<"ATTENDANCE" | "KIT">("ATTENDANCE");
  const operationTypeRef = useRef<"ATTENDANCE" | "KIT">("ATTENDANCE");
  const [feedback, setFeedback] = useState<FeedbackState>({ type: "idle", message: "Awaiting scan..." });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Sync state to ref so handleScan always has the latest value without changing its reference
  useEffect(() => {
    operationTypeRef.current = operationType;
  }, [operationType]);

  useEffect(() => {
    const sse = new EventSource("/api/live-sync");
    sse.onmessage = () => {
      setIsSyncing(true);
      setTimeout(() => setIsSyncing(false), 1000);
    };
    return () => sse.close();
  }, []);

  const handleScan = useCallback(async (decodedText: string) => {
    if (isPaused) return;

    setIsPaused(true);
    setFeedback({ type: "idle", message: "Processing..." });

    try {
      const res = await fetch("/api/scanner/qr-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrData: decodedText,
          stationId,
          eventId,
          operationType: operationTypeRef.current,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFeedback({ type: "error", message: data.error || "Scan failed" });
      } else if (data.message && data.message.toLowerCase().includes("already")) {
        setFeedback({ type: "warning", message: data.message });
      } else {
        setFeedback({ type: "success", message: data.message || "Success!" });
      }
    } catch (err) {
      setFeedback({ type: "error", message: "Network error occurred." });
    }

    setTimeout(() => {
      setFeedback({ type: "idle", message: "Awaiting scan..." });
      setIsPaused(false);
    }, 2500);
  }, [eventId, stationId, isPaused]);

  let feedbackColor = "bg-gray-100 text-gray-700 border-gray-200";
  if (feedback.type === "success") feedbackColor = "bg-green-100 text-green-800 border-green-400";
  else if (feedback.type === "warning") feedbackColor = "bg-yellow-100 text-yellow-800 border-yellow-400";
  else if (feedback.type === "error") feedbackColor = "bg-red-100 text-red-800 border-red-400";

  return (
    <div className="flex flex-col w-full max-w-md mx-auto bg-white shadow-xl rounded-2xl overflow-hidden">
      {/* Top Zone: Status bar + "Live Sync" */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
        <h2 className="font-semibold text-sm tracking-wider">SCANNER TERMINAL</h2>
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${isSyncing ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" : "bg-gray-500"}`}></span>
          Live Sync
        </div>
      </div>

      {/* Center Zone: Camera viewfinder */}
      <div className="bg-black relative min-h-[300px] w-full flex items-center justify-center overflow-hidden">
        <div className="w-full relative">
          <Scanner
            paused={isPaused}
            onScan={(result) => {
              if (result && result.length > 0) {
                handleScan(result[0].rawValue);
              }
            }}
            allowMultiple={true}
            scanDelay={500}
            constraints={{ facingMode: "environment" }}
            components={{
              zoom: true,
              finder: true,
            }}
          />
          {isPaused && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-10 backdrop-blur-sm">
              <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-white text-sm font-semibold tracking-wide">PROCESSING</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Zone: Action hub */}
      <div className="p-4 bg-gray-50 flex flex-col gap-4">
        <div className="flex bg-gray-200 p-1 rounded-lg">
          <button
            onClick={() => setOperationType("ATTENDANCE")}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
              operationType === "ATTENDANCE" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            ATTENDANCE
          </button>
          <button
            onClick={() => setOperationType("KIT")}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
              operationType === "KIT" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            KIT ISSUANCE
          </button>
        </div>

        <div className={`p-4 rounded-lg border text-center font-medium ${feedbackColor} transition-colors duration-300 min-h-[80px] flex items-center justify-center`}>
          {feedback.message}
        </div>
      </div>
    </div>
  );
}
