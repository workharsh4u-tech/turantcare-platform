import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

interface QRScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);

  const startScanner = async () => {
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (isRunningRef.current) {
            isRunningRef.current = false;
            scanner.stop().then(() => onScan(decodedText)).catch(() => onScan(decodedText));
          }
        },
        () => {}
      );
      isRunningRef.current = true;
      setStarted(true);
    } catch (err) {
      setError("Camera access denied or unavailable.");
      console.error(err);
    }
  };

  useEffect(() => {
    return () => {
      if (isRunningRef.current && scannerRef.current) {
        isRunningRef.current = false;
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-elevated p-6 max-w-sm w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <Camera className="w-5 h-5" /> Scan QR Code
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div id="qr-reader" className="rounded-lg overflow-hidden" />
        {!started && !error && (
          <Button onClick={startScanner} className="w-full mt-3">
            <Camera className="w-4 h-4 mr-2" /> Start Camera
          </Button>
        )}
        {error && <p className="text-destructive text-sm mt-3">{error}</p>}
      </div>
    </div>
  );
}
