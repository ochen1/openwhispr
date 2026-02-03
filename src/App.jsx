import React, { useState, useEffect, useRef } from "react";
import "./index.css";
import { X, VolumeX } from "lucide-react";
import { useToast } from "./components/ui/Toast";
import { LoadingDots } from "./components/ui/LoadingDots";
import { useHotkey } from "./hooks/useHotkey";
import { useWindowDrag } from "./hooks/useWindowDrag";
import { useAudioRecording } from "./hooks/useAudioRecording";

// Sound Wave Icon Component (for idle/hover states)
const SoundWaveIcon = ({ size = 16 }) => {
  return (
    <div className="flex items-center justify-center gap-1">
      <div
        className={`bg-white rounded-full`}
        style={{ width: size * 0.25, height: size * 0.6 }}
      ></div>
      <div className={`bg-white rounded-full`} style={{ width: size * 0.25, height: size }}></div>
      <div
        className={`bg-white rounded-full`}
        style={{ width: size * 0.25, height: size * 0.6 }}
      ></div>
    </div>
  );
};

// Voice Wave Animation Component (for processing state)
const VoiceWaveIndicator = ({ isListening }) => {
  return (
    <div className="flex items-center justify-center gap-0.5">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className={`w-0.5 bg-white rounded-full transition-all duration-150 ${
            isListening ? "animate-pulse h-4" : "h-2"
          }`}
          style={{
            animationDelay: isListening ? `${i * 0.1}s` : "0s",
            animationDuration: isListening ? `${0.6 + i * 0.1}s` : "0s",
          }}
        />
      ))}
    </div>
  );
};

// Audio Level Visualizer Component - shows real-time mic activity during recording
const AudioLevelVisualizer = ({ audioLevel, voiceDetected, isVoiceActive }) => {
  // Normalize and scale the audio level for visual display (0-100%)
  const normalizedLevel = Math.min(100, Math.max(0, audioLevel * 500));

  return (
    <div className="flex items-center justify-center gap-0.5">
      {[...Array(5)].map((_, i) => {
        // Each bar has a threshold - bars light up based on audio level
        const barThreshold = (i + 1) * 20;
        const isActive = normalizedLevel >= barThreshold;
        const isPartiallyActive = normalizedLevel >= barThreshold - 10;

        // Calculate dynamic height based on audio level
        const baseHeight = 4;
        const maxHeight = 16;
        const heightPercent = isActive ? 1 : isPartiallyActive ? 0.5 : 0.3;
        const height = baseHeight + (maxHeight - baseHeight) * heightPercent;

        return (
          <div
            key={i}
            className={`w-0.5 rounded-full transition-all duration-75 ${
              voiceDetected && isActive
                ? "bg-green-400"
                : isVoiceActive && isPartiallyActive
                  ? "bg-yellow-400"
                  : "bg-white/40"
            }`}
            style={{
              height: `${height}px`,
              transform: isVoiceActive ? `scaleY(${0.8 + audioLevel * 2})` : "scaleY(1)",
            }}
          />
        );
      })}
    </div>
  );
};

// No Audio Toast Component - popover that appears when recording has no audio
const NoAudioToast = ({ isVisible, onDismiss }) => {
  const toastRef = useRef(null);

  useEffect(() => {
    if (!isVisible) return;

    // Handle click outside to dismiss
    const handleClickOutside = (event) => {
      if (toastRef.current && !toastRef.current.contains(event.target)) {
        onDismiss();
      }
    };

    // Handle escape key to dismiss
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVisible, onDismiss]);

  if (!isVisible) return null;

  return (
    <div
      ref={toastRef}
      className="absolute bottom-full right-0 mb-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800/95 border border-white/10 shadow-lg backdrop-blur-sm">
        <VolumeX size={14} className="text-yellow-400 flex-shrink-0" />
        <span className="text-xs text-white/90 whitespace-nowrap">No audio detected</span>
      </div>
    </div>
  );
};

// Enhanced Tooltip Component
const Tooltip = ({ children, content, emoji }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <div onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
        {children}
      </div>
      {isVisible && (
        <div
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-1 py-1 text-white bg-gradient-to-r from-neutral-800 to-neutral-700 rounded-md whitespace-nowrap z-10 transition-opacity duration-150"
          style={{ fontSize: "9.7px" }}
        >
          {emoji && <span className="mr-1">{emoji}</span>}
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-neutral-800"></div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [isHovered, setIsHovered] = useState(false);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const commandMenuRef = useRef(null);
  const buttonRef = useRef(null);
  const { toast } = useToast();
  const { hotkey } = useHotkey();
  const { isDragging, handleMouseDown, handleMouseUp } = useWindowDrag();
  const [dragStartPos, setDragStartPos] = useState(null);
  const [hasDragged, setHasDragged] = useState(false);

  const setWindowInteractivity = React.useCallback((shouldCapture) => {
    window.electronAPI?.setMainWindowInteractivity?.(shouldCapture);
  }, []);

  useEffect(() => {
    setWindowInteractivity(false);
    return () => setWindowInteractivity(false);
  }, [setWindowInteractivity]);

  useEffect(() => {
    const unsubscribeFallback = window.electronAPI?.onHotkeyFallbackUsed?.((data) => {
      toast({
        title: "Hotkey Changed",
        description: data.message,
        duration: 8000,
      });
    });

    const unsubscribeFailed = window.electronAPI?.onHotkeyRegistrationFailed?.((data) => {
      toast({
        title: "Hotkey Unavailable",
        description: `Could not register hotkey. Please set a different hotkey in Settings.`,
        duration: 10000,
      });
    });

    return () => {
      unsubscribeFallback?.();
      unsubscribeFailed?.();
    };
  }, [toast]);

  useEffect(() => {
    if (isCommandMenuOpen) {
      setWindowInteractivity(true);
    } else if (!isHovered) {
      setWindowInteractivity(false);
    }
  }, [isCommandMenuOpen, isHovered, setWindowInteractivity]);

  const handleDictationToggle = React.useCallback(() => {
    setIsCommandMenuOpen(false);
    setWindowInteractivity(false);
  }, [setWindowInteractivity]);

  const {
    isRecording,
    isProcessing,
    toggleListening,
    cancelRecording,
    vadState,
    showNoAudioToast,
    dismissNoAudioToast,
  } = useAudioRecording(toast, {
    onToggle: handleDictationToggle,
  });

  const handleClose = () => {
    window.electronAPI.hideWindow();
  };

  useEffect(() => {
    if (!isCommandMenuOpen) {
      return;
    }

    const handleClickOutside = (event) => {
      if (
        commandMenuRef.current &&
        !commandMenuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsCommandMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCommandMenuOpen]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === "Escape") {
        if (showNoAudioToast) {
          dismissNoAudioToast();
        } else if (isCommandMenuOpen) {
          setIsCommandMenuOpen(false);
        } else {
          handleClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [isCommandMenuOpen, showNoAudioToast, dismissNoAudioToast]);

  // Determine current mic state
  const getMicState = () => {
    if (isRecording) return "recording";
    if (isProcessing) return "processing";
    if (isHovered && !isRecording && !isProcessing) return "hover";
    return "idle";
  };

  const micState = getMicState();

  // Get recording tooltip with VAD status
  const getRecordingTooltip = () => {
    if (vadState.voiceDetected) {
      return "Voice detected - recording...";
    }
    return "Listening... speak now";
  };

  const getMicButtonProps = () => {
    const baseClasses =
      "rounded-full w-10 h-10 flex items-center justify-center relative overflow-hidden border-2 cursor-pointer";

    switch (micState) {
      case "idle":
        return {
          className: `${baseClasses} bg-black/50 border-white/70`,
          tooltip: `Press [${hotkey}] to speak`,
        };
      case "hover":
        return {
          className: `${baseClasses} bg-black/50 border-white/70`,
          tooltip: `Press [${hotkey}] to speak`,
        };
      case "recording":
        // Change border color based on VAD status
        const borderColor = vadState.voiceDetected
          ? "border-green-400"
          : vadState.isVoiceActive
            ? "border-yellow-400"
            : "border-blue-300";
        return {
          className: `${baseClasses} bg-blue-600 ${borderColor}`,
          tooltip: getRecordingTooltip(),
        };
      case "processing":
        return {
          className: `${baseClasses} bg-purple-600 border-purple-300 cursor-not-allowed`,
          tooltip: "Processing...",
        };
      default:
        return {
          className: `${baseClasses} bg-black/50 border-white/70`,
          style: { transform: "scale(0.8)" },
          tooltip: "Click to speak",
        };
    }
  };

  const micProps = getMicButtonProps();

  return (
    <>
      {/* Fixed bottom-right voice button */}
      <div className="fixed bottom-6 right-6 z-50">
        <div
          className="relative flex items-center gap-2"
          onMouseEnter={() => {
            setIsHovered(true);
            setWindowInteractivity(true);
          }}
          onMouseLeave={() => {
            setIsHovered(false);
            if (!isCommandMenuOpen) {
              setWindowInteractivity(false);
            }
          }}
        >
          {/* No Audio Toast */}
          <NoAudioToast isVisible={showNoAudioToast} onDismiss={dismissNoAudioToast} />

          {isRecording && isHovered && (
            <Tooltip content="Cancel recording">
              <button
                aria-label="Cancel recording"
                onClick={(e) => {
                  e.stopPropagation();
                  cancelRecording();
                }}
                className="w-7 h-7 rounded-full bg-neutral-800/90 hover:bg-red-500 border border-white/20 hover:border-red-400 flex items-center justify-center transition-all duration-150 shadow-lg backdrop-blur-sm"
              >
                <X size={12} strokeWidth={2.5} color="white" />
              </button>
            </Tooltip>
          )}
          <Tooltip content={micProps.tooltip}>
            <button
              ref={buttonRef}
              onMouseDown={(e) => {
                setIsCommandMenuOpen(false);
                setDragStartPos({ x: e.clientX, y: e.clientY });
                setHasDragged(false);
                handleMouseDown(e);
              }}
              onMouseMove={(e) => {
                if (dragStartPos && !hasDragged) {
                  const distance = Math.sqrt(
                    Math.pow(e.clientX - dragStartPos.x, 2) +
                      Math.pow(e.clientY - dragStartPos.y, 2)
                  );
                  if (distance > 5) {
                    // 5px threshold for drag
                    setHasDragged(true);
                  }
                }
              }}
              onMouseUp={(e) => {
                handleMouseUp(e);
                setDragStartPos(null);
              }}
              onClick={(e) => {
                if (!hasDragged) {
                  setIsCommandMenuOpen(false);
                  toggleListening();
                }
                e.preventDefault();
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!hasDragged) {
                  setWindowInteractivity(true);
                  setIsCommandMenuOpen((prev) => !prev);
                }
              }}
              onFocus={() => setIsHovered(true)}
              onBlur={() => setIsHovered(false)}
              className={micProps.className}
              style={{
                ...micProps.style,
                cursor:
                  micState === "processing"
                    ? "not-allowed !important"
                    : isDragging
                      ? "grabbing !important"
                      : "pointer !important",
                transition:
                  "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.25s ease-out, border-color 0.15s ease-out",
              }}
            >
              {/* Background effects */}
              <div
                className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent transition-opacity duration-150"
                style={{ opacity: micState === "hover" ? 0.8 : 0 }}
              ></div>
              <div
                className="absolute inset-0 transition-colors duration-150"
                style={{
                  backgroundColor: micState === "hover" ? "rgba(0,0,0,0.1)" : "transparent",
                }}
              ></div>

              {/* Dynamic content based on state */}
              {micState === "idle" || micState === "hover" ? (
                <SoundWaveIcon size={micState === "idle" ? 12 : 14} />
              ) : micState === "recording" ? (
                <AudioLevelVisualizer
                  audioLevel={vadState.audioLevel}
                  voiceDetected={vadState.voiceDetected}
                  isVoiceActive={vadState.isVoiceActive}
                />
              ) : micState === "processing" ? (
                <VoiceWaveIndicator isListening={true} />
              ) : null}

              {/* State indicator ring for recording - changes based on VAD */}
              {micState === "recording" && (
                <div
                  className={`absolute inset-0 rounded-full border-2 transition-colors duration-150 ${
                    vadState.voiceDetected
                      ? "border-green-300 opacity-80"
                      : "border-blue-300 animate-pulse"
                  }`}
                ></div>
              )}

              {/* Voice detected indicator glow */}
              {micState === "recording" && vadState.voiceDetected && (
                <div className="absolute inset-0 rounded-full bg-green-400/20 animate-pulse"></div>
              )}

              {/* State indicator ring for processing */}
              {micState === "processing" && (
                <div className="absolute inset-0 rounded-full border-2 border-purple-300 opacity-50"></div>
              )}
            </button>
          </Tooltip>
          {isCommandMenuOpen && (
            <div
              ref={commandMenuRef}
              className="absolute bottom-full right-0 mb-3 w-48 rounded-lg border border-white/10 bg-neutral-900/95 text-white shadow-lg backdrop-blur-sm"
              onMouseEnter={() => {
                setWindowInteractivity(true);
              }}
              onMouseLeave={() => {
                if (!isHovered) {
                  setWindowInteractivity(false);
                }
              }}
            >
              <button
                className="w-full px-3 py-2 text-left text-sm font-medium hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                onClick={() => {
                  toggleListening();
                }}
              >
                {isRecording ? "Stop listening" : "Start listening"}
              </button>
              <div className="h-px bg-white/10" />
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                onClick={() => {
                  setIsCommandMenuOpen(false);
                  setWindowInteractivity(false);
                  handleClose();
                }}
              >
                Hide this for now
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
