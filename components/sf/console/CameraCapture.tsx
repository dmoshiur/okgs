"use client";

/**
 * Desk camera — capture a live photo and upload it straight to Cloudinary.
 *
 * Used by the outside-guest registration form: the device camera opens in a
 * small viewer, one press captures a 3:4 JPEG frame, and the frame uploads
 * directly to Cloudinary through the shared signed/unsigned pipeline
 * (`lib/upload-client.ts`). The returned `secure_url` is handed to the caller
 * — it becomes the guest's photo on the profile and on the printed ticket.
 *
 * When no camera is available (permission denied, no device) the picker
 * falls back to a plain file input, so registration never dead-ends.
 * Nothing is kept in browser storage; once uploaded, only the URL survives.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageUp, Loader2, RefreshCcw, X } from "lucide-react";
import { uploadToCloudinary } from "@/lib/upload-client";

type Phase = "idle" | "starting" | "live" | "capturing" | "uploading" | "done";

export function CameraCapture({
  label,
  folder,
  photoUrl,
  onPhoto,
  onError,
}: {
  /** Field label shown above the viewer. */
  label: string;
  /** Cloudinary sub-folder, e.g. "guests". */
  folder: string;
  /** Currently stored URL (kept by the parent form). */
  photoUrl: string;
  /** Called with the Cloudinary URL after a successful capture/upload. */
  onPhoto: (url: string) => void;
  /** Human-readable failure text for the parent form's error line. */
  onError: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>(photoUrl ? "done" : "idle");
  const [preview, setPreview] = useState<string>(photoUrl);
  const [progress, setProgress] = useState(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopStream, [stopStream]);

  async function startCamera() {
    onError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      // No camera API (old browser / http origin) — use the file picker.
      fileRef.current?.click();
      return;
    }
    setPhase("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setPhase("live");
    } catch {
      setPhase("idle");
      onError("The camera could not be opened — allow camera access, or use “Upload a photo” instead.");
    }
  }

  function frameToBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) {
        reject(new Error("no-frame"));
        return;
      }
      // Centre-crop the live frame to the ticket's 3:4 portrait shape.
      const targetRatio = 3 / 4;
      const sourceRatio = video.videoWidth / video.videoHeight;
      const cropWidth = sourceRatio > targetRatio ? video.videoHeight * targetRatio : video.videoWidth;
      const cropHeight = cropWidth / targetRatio;
      const sx = (video.videoWidth - cropWidth) / 2;
      const sy = (video.videoHeight - cropHeight) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 960;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("no-canvas"));
        return;
      }
      context.drawImage(video, sx, sy, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("no-blob"))), "image/jpeg", 0.92);
    });
  }

  async function uploadFile(file: File) {
    setPhase("uploading");
    setProgress(0);
    try {
      const result = await uploadToCloudinary({
        file,
        prefix: folder,
        label: label.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "photo",
        tags: ["okgs", folder],
        onProgress: setProgress,
      });
      setPreview(result.url);
      setPhase("done");
      onPhoto(result.url);
    } catch (issue) {
      setPhase(photoUrl ? "done" : "idle");
      onError(issue instanceof Error ? issue.message : "The photo upload failed — try again.");
    }
  }

  async function capture() {
    setPhase("capturing");
    try {
      const blob = await frameToBlob();
      stopStream();
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      await uploadFile(new File([blob], `${folder}-${stamp}.jpg`, { type: "image/jpeg" }));
    } catch {
      setPhase("live");
      onError("Could not capture a frame — try again.");
    }
  }

  async function retake() {
    stopStream();
    setPreview(photoUrl);
    setPhase("idle");
    onPhoto(photoUrl);
  }

  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    void uploadFile(file);
  }

  return (
    <div className="sf-camera" style={{ display: "grid", gap: 8 }}>
      <span className="v2-label">{label}</span>
      <div
        style={{
          position: "relative",
          display: "grid",
          placeItems: "center",
          width: "100%",
          maxWidth: 240,
          aspectRatio: "3 / 4",
          overflow: "hidden",
          borderRadius: 10,
          border: "1px solid var(--line, #cbd5e1)",
          background: "repeating-linear-gradient(45deg, #f8fafc 0 8px, #eef2f7 8px 16px)",
        }}
      >
        {phase === "live" || phase === "starting" ? (
          <video ref={videoRef} muted playsInline autoPlay style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`${label} preview`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", padding: 12 }}>
            {phase === "uploading" ? "Uploading to Cloudinary…" : "No photo yet"}
          </span>
        )}
        {phase === "uploading" ? (
          <span
            style={{
              position: "absolute",
              inset: "auto 0 0 0",
              padding: "4px 8px",
              background: "rgba(15, 23, 42, .72)",
              color: "#fff",
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Loader2 size={12} className="spin" /> Uploading {progress}%
          </span>
        ) : null}
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={pickFile} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {phase === "idle" ? (
          <>
            <button type="button" className="v2-btn v2-btn-sm" onClick={() => void startCamera()}>
              <Camera size={14} /> Open camera
            </button>
            <button type="button" className="v2-btn v2-btn-sm v2-btn-ghost" onClick={() => fileRef.current?.click()}>
              <ImageUp size={14} /> Upload a photo
            </button>
          </>
        ) : null}
        {phase === "live" ? (
          <>
            <button type="button" className="v2-btn v2-btn-sm" onClick={() => void capture()}>
              <Camera size={14} /> Capture photo
            </button>
            <button type="button" className="v2-btn v2-btn-sm v2-btn-ghost" onClick={stopStream}>
              <X size={14} /> Close camera
            </button>
          </>
        ) : null}
        {phase === "done" && preview ? (
          <button type="button" className="v2-btn v2-btn-sm v2-btn-ghost" onClick={() => void retake()}>
            <RefreshCcw size={14} /> Retake
          </button>
        ) : null}
        {(phase === "starting" || phase === "capturing" || phase === "uploading") && (
          <button type="button" className="v2-btn v2-btn-sm" disabled>
            <Loader2 size={14} className="spin" /> {phase === "uploading" ? `Uploading ${progress}%` : "Please wait…"}
          </button>
        )}
      </div>
    </div>
  );
}
