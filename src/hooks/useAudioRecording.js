import { useState, useEffect, useRef, useCallback } from "react";
import AudioManager from "../helpers/audioManager";

// VAD state type for documentation
// {
//   audioLevel: number (0-1),
//   peakLevel: number (0-1),
//   voiceDetected: boolean,
//   isVoiceActive: boolean,
//   speechDuration: number (seconds)
// }

export const useAudioRecording = (toast, options = {}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [vadState, setVadState] = useState({
    audioLevel: 0,
    peakLevel: 0,
    voiceDetected: false,
    isVoiceActive: false,
    speechDuration: 0,
  });
  const [showNoAudioToast, setShowNoAudioToast] = useState(false);
  const audioManagerRef = useRef(null);
  const noAudioTimeoutRef = useRef(null);
  const { onToggle } = options;

  // Dismiss the no audio toast with robust cleanup
  const dismissNoAudioToast = useCallback(() => {
    setShowNoAudioToast(false);
    if (noAudioTimeoutRef.current) {
      clearTimeout(noAudioTimeoutRef.current);
      noAudioTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    audioManagerRef.current = new AudioManager();

    audioManagerRef.current.setCallbacks({
      onStateChange: ({ isRecording, isProcessing }) => {
        setIsRecording(isRecording);
        setIsProcessing(isProcessing);
        // Reset VAD state when not recording
        if (!isRecording) {
          setVadState({
            audioLevel: 0,
            peakLevel: 0,
            voiceDetected: false,
            isVoiceActive: false,
            speechDuration: 0,
          });
        }
      },
      onError: (error) => {
        toast({
          title: error.title,
          description: error.description,
          variant: "destructive",
        });
      },
      onTranscriptionComplete: async (result) => {
        if (result.success) {
          setTranscript(result.text);

          await audioManagerRef.current.safePaste(result.text);

          audioManagerRef.current.saveTranscription(result.text);

          if (result.source === "openai" && localStorage.getItem("useLocalWhisper") === "true") {
            toast({
              title: "Fallback Mode",
              description: "Local Whisper failed. Used OpenAI API instead.",
              variant: "default",
            });
          }
        }
      },
      onVADStateChange: (state) => {
        setVadState(state);
      },
      onNoAudioDetected: () => {
        // Show the no audio toast
        setShowNoAudioToast(true);

        // Clear any existing timeout
        if (noAudioTimeoutRef.current) {
          clearTimeout(noAudioTimeoutRef.current);
        }

        // Auto-dismiss after 2 seconds
        noAudioTimeoutRef.current = setTimeout(() => {
          setShowNoAudioToast(false);
          noAudioTimeoutRef.current = null;
        }, 2000);
      },
    });

    // Set up hotkey listener for tap-to-talk mode
    const handleToggle = () => {
      const currentState = audioManagerRef.current.getState();

      if (!currentState.isRecording && !currentState.isProcessing) {
        // Dismiss no audio toast when starting new recording
        dismissNoAudioToast();
        audioManagerRef.current.startRecording();
      } else if (currentState.isRecording) {
        audioManagerRef.current.stopRecording();
      }
    };

    // Set up listener for push-to-talk start
    const handleStart = () => {
      const currentState = audioManagerRef.current.getState();
      if (!currentState.isRecording && !currentState.isProcessing) {
        dismissNoAudioToast();
        audioManagerRef.current.startRecording();
      }
    };

    // Set up listener for push-to-talk stop
    const handleStop = () => {
      const currentState = audioManagerRef.current.getState();
      if (currentState.isRecording) {
        audioManagerRef.current.stopRecording();
      }
    };

    const disposeToggle = window.electronAPI.onToggleDictation(() => {
      handleToggle();
      onToggle?.();
    });

    const disposeStart = window.electronAPI.onStartDictation?.(() => {
      handleStart();
      onToggle?.();
    });

    const disposeStop = window.electronAPI.onStopDictation?.(() => {
      handleStop();
      onToggle?.();
    });

    const handleNoAudioDetected = () => {
      toast({
        title: "No Audio Detected",
        description: "The recording contained no detectable audio. Please try again.",
        variant: "default",
      });
    };

    const disposeNoAudio = window.electronAPI.onNoAudioDetected?.(handleNoAudioDetected);

    // Cleanup
    return () => {
      disposeToggle?.();
      disposeStart?.();
      disposeStop?.();
      disposeNoAudio?.();
      if (noAudioTimeoutRef.current) {
        clearTimeout(noAudioTimeoutRef.current);
      }
      if (audioManagerRef.current) {
        audioManagerRef.current.cleanup();
      }
    };
  }, [toast, onToggle, dismissNoAudioToast]);

  const startRecording = async () => {
    if (audioManagerRef.current) {
      dismissNoAudioToast();
      return await audioManagerRef.current.startRecording();
    }
    return false;
  };

  const stopRecording = () => {
    if (audioManagerRef.current) {
      return audioManagerRef.current.stopRecording();
    }
    return false;
  };

  const cancelRecording = () => {
    if (audioManagerRef.current) {
      return audioManagerRef.current.cancelRecording();
    }
    return false;
  };

  const toggleListening = () => {
    if (!isRecording && !isProcessing) {
      startRecording();
    } else if (isRecording) {
      stopRecording();
    }
  };

  return {
    isRecording,
    isProcessing,
    transcript,
    vadState,
    showNoAudioToast,
    dismissNoAudioToast,
    startRecording,
    stopRecording,
    cancelRecording,
    toggleListening,
  };
};
