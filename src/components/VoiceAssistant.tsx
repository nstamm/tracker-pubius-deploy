import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, X, Check, Loader2, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, getErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ParsedOperation {
  monto: number;
  porcentaje: number;
  tipo: string;
}

const TIPO_KEYWORDS: Record<string, string> = {
  zelle: "Zelle",
  paypal: "Paypal",
  skrill: "Skrill",
  binance: "Binance",
  slash: "Slash",
  mercury: "Mercury",
  comisión: "Comisión",
  comision: "Comisión",
};

const WORD_TO_NUM: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciséis: 16, dieciseis: 16,
  diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
  veintiuno: 21, veintidós: 22, veintidos: 22, veintitrés: 23, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiséis: 26, veintiseis: 26,
  veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30,
  cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400,
  quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
};

function spanishTextToNumber(text: string): number | null {
  const cleaned = text.trim().toLowerCase()
    .replace(/por ciento/g, "")
    .replace(/porciento/g, "")
    .replace(/dólares/g, "")
    .replace(/dolares/g, "")
    .replace(/usdt/g, "")
    .trim();

  // Already a number
  const direct = parseFloat(cleaned.replace(",", "."));
  if (!isNaN(direct)) return direct;

  // Handle compound Spanish numbers like "dos mil quinientos"
  const words = cleaned.split(/[\s,]+/).filter(w => w && w !== "y");
  if (words.length === 0) return null;

  let total = 0;
  let current = 0;

  for (const word of words) {
    if (word === "mil") {
      total += (current === 0 ? 1 : current) * 1000;
      current = 0;
    } else if (word === "millón" || word === "millon" || word === "millones") {
      total += (current === 0 ? 1 : current) * 1000000;
      current = 0;
    } else if (WORD_TO_NUM[word] !== undefined) {
      current += WORD_TO_NUM[word];
    } else {
      // Try parsing as number (e.g. "2.5")
      const num = parseFloat(word.replace(",", "."));
      if (!isNaN(num)) {
        current += num;
      }
    }
  }
  total += current;

  return total > 0 ? total : null;
}

function parseOperation(text: string): ParsedOperation | null {
  const normalized = text.toLowerCase().trim()
    .replace(/por ciento/g, "%")
    .replace(/porciento/g, "%");

  let tipo = "A definir";
  for (const [keyword, value] of Object.entries(TIPO_KEYWORDS)) {
    if (normalized.includes(keyword)) {
      tipo = value;
      break;
    }
  }

  // Try pattern: <amount> al <percentage>
  // First try with numbers already present
  const numericMatch = normalized.match(/([\d.,]+)\s*(?:al|a)\s*([\d.,]+)/);
  if (numericMatch) {
    const monto = parseFloat(numericMatch[1].replace(",", "."));
    const porcentaje = parseFloat(numericMatch[2].replace(",", "."));
    if (!isNaN(monto) && !isNaN(porcentaje)) return { monto, porcentaje, tipo };
  }

  // Try with Spanish words: split on "al" or "a el"
  const alMatch = normalized.match(/(.+?)\s+(?:al|a el|a)\s+(.+?)(?:\s+por\s+|\s*%|$)/);
  if (alMatch) {
    const monto = spanishTextToNumber(alMatch[1]);
    const porcentaje = spanishTextToNumber(alMatch[2]);
    if (monto && porcentaje && monto > porcentaje) return { monto, porcentaje, tipo };
  }

  // Fallback: find two numbers in the text, larger = monto, smaller = porcentaje
  const allNumbers: number[] = [];
  // Extract explicit numbers
  const nums = normalized.match(/[\d.,]+/g);
  if (nums) nums.forEach(n => { const v = parseFloat(n.replace(",", ".")); if (!isNaN(v)) allNumbers.push(v); });

  // Extract word-based numbers from segments
  const segments = normalized.split(/[,.]|\bal\b|\ba\b|\bpor\b|\bde\b|\bcon\b/);
  for (const seg of segments) {
    const num = spanishTextToNumber(seg);
    if (num && !allNumbers.includes(num)) allNumbers.push(num);
  }

  if (allNumbers.length >= 2) {
    allNumbers.sort((a, b) => b - a);
    return { monto: allNumbers[0], porcentaje: allNumbers[1], tipo };
  }

  return null;
}

interface VoiceAssistantProps {
  onSuccess?: () => void;
}

const VoiceAssistant = ({ onSuccess }: VoiceAssistantProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsed, setParsed] = useState<ParsedOperation | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [textInput, setTextInput] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const processText = useCallback((text: string) => {
    setTranscript(text);
    const result = parseOperation(text);
    setParsed(result);
    setShowResult(true);
  }, []);

  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const { text } = await api.transcribe(audioBlob);
      if (text && text.trim()) {
        processText(text.trim());
      } else {
        toast.error("No se detectó audio. Intenta de nuevo.");
      }
    } catch (error) {
      console.error("Transcription error:", error);
      toast.error(getErrorMessage(error, "Error al transcribir el audio"));
    } finally {
      setIsTranscribing(false);
    }
  }, [processText]);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (audioBlob.size > 0) {
          transcribeAudio(audioBlob);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsListening(true);
      setTranscript("");
      setParsed(null);
      setShowResult(false);
    } catch (error) {
      console.error("Microphone error:", error);
      toast.error("No se pudo acceder al micrófono. Verifica los permisos.");
    }
  }, [transcribeAudio]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const handleTextSubmit = () => {
    const text = textInput.trim();
    if (!text) return;
    processText(text);
    setTextInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  const createOperation = async () => {
    if (!parsed) return;
    setIsCreating(true);

    try {
      await api.operations.create({
        fecha_operacion: new Date().toISOString().split("T")[0],
        id_operacion: null,
        cuenta_emisora: null,
        cuenta_receptora: null,
        monto_total: parsed.monto,
        porcentaje_ganancia: parsed.porcentaje,
        tipo_operacion: parsed.tipo,
      });

      toast.success(
        `Operación creada: $${parsed.monto} al ${parsed.porcentaje}% (${parsed.tipo})`
      );
      setShowResult(false);
      setTranscript("");
      setParsed(null);
      onSuccess?.();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al crear operación"));
    } finally {
      setIsCreating(false);
    }
  };

  const dismiss = () => {
    setShowResult(false);
    setTranscript("");
    setParsed(null);
  };

  const toggleOpen = () => {
    if (isOpen) {
      setIsOpen(false);
      setShowResult(false);
      setTranscript("");
      setParsed(null);
      setTextInput("");
      if (isListening) stopListening();
    } else {
      setIsOpen(true);
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-4 md:bottom-8 md:right-24 z-50 bg-card border border-border rounded-xl shadow-2xl w-80 animate-in slide-in-from-bottom-4 fade-in overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Asistente rápido</span>
            <button onClick={toggleOpen} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {showResult && (
            <div className="p-4 border-b border-border">
              {parsed ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Operación detectada:</p>
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-foreground">
                      ${parsed.monto.toLocaleString("es-ES")} al {parsed.porcentaje}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Ganancia: <span className="text-primary font-semibold">
                        ${((parsed.monto * parsed.porcentaje) / 100).toFixed(2)}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Tipo: <span className="font-medium text-foreground">{parsed.tipo}</span>
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground italic">"{transcript}"</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={createOperation} disabled={isCreating} className="flex-1 gap-1">
                      {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Crear
                    </Button>
                    <Button size="sm" variant="outline" onClick={dismiss} className="gap-1">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-destructive font-medium">No se pudo interpretar</p>
                  <p className="text-xs text-muted-foreground italic">"{transcript}"</p>
                  <p className="text-xs text-muted-foreground">
                    Intenta algo como "1000 al 2" o "500 al 3 por zelle"
                  </p>
                  <Button size="sm" variant="outline" onClick={dismiss} className="w-full">
                    Cerrar
                  </Button>
                </div>
              )}
            </div>
          )}

          {(isListening || isTranscribing) && (
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                </span>
                <p className="text-xs text-muted-foreground">
                  {isTranscribing ? "Transcribiendo..." : "Grabando... toca para detener"}
                </p>
              </div>
            </div>
          )}

          {!showResult && (
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Escribe o dicta: "1000 al 2" o "500 al 3 por zelle"
              </p>
              <div className="flex gap-2">
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ej: 1000 al 2"
                  className="flex-1 h-10 text-sm"
                  disabled={isListening || isTranscribing}
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleTextSubmit}
                  disabled={!textInput.trim() || isListening || isTranscribing}
                  className="h-10 w-10 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant={isListening ? "destructive" : "outline"}
                  onClick={isListening ? stopListening : startListening}
                  disabled={isTranscribing}
                  className={cn("h-10 w-10 shrink-0", isListening && "animate-pulse")}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={toggleOpen}
        className={cn(
          "fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50 h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200",
          isOpen
            ? "bg-muted text-muted-foreground hover:bg-muted/80"
            : "bg-primary text-primary-foreground hover:scale-105 hover:shadow-xl"
        )}
        aria-label="Asistente rápido"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </button>
    </>
  );
};

export default VoiceAssistant;
