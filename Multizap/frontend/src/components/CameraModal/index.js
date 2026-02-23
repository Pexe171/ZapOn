import React, { useEffect, useRef, useState } from 'react';
import Modal from 'react-modal';
import Camera, { FACING_MODES } from 'react-html5-camera-photo';
import 'react-html5-camera-photo/build/css/index.css';

Modal.setAppElement('#root');

const customStyles = {
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    width: '80%',
    height: '70%',
    maxWidth: '780px',
    maxHeight: '85vh',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    borderRadius: '8px',
    boxShadow: '0 0 10px rgba(0, 0, 0, 0.3)',
    border: 'none',
    padding: '0',
    background: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    overflow: 'hidden',
  },
};

const toolbarStyle = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  padding: 10,
  background: 'rgba(0,0,0,0.35)',
};

const buttonStyle = (active = false) => ({
  padding: '8px 12px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  color: '#fff',
  background: active ? 'rgba(0, 200, 120, 0.85)' : 'rgba(0,0,0,0.55)',
});

const actionStyle = (danger = false) => ({
  padding: '10px 14px',
  borderRadius: 10,
  border: 'none',
  cursor: 'pointer',
  fontWeight: 700,
  color: '#fff',
  background: danger ? 'rgba(220, 60, 60, 0.9)' : 'rgba(0, 140, 255, 0.9)',
});

function pickSupportedMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];

  for (const t of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return '';
}

const CameraModal = ({ isOpen, onRequestClose, onCapture }) => {
  const [mode, setMode] = useState('photo'); // 'photo' | 'video'
  // Estado capturedImage removido pois não é necessário renderizá-lo, processamos direto.

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const [isRecording, setIsRecording] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1.1) Adicionando estados e ref do Timer
  const MAX_SECONDS = 60;
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef(null);

  const stopAllTracks = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    } catch (e) {}
    streamRef.current = null;
  };

  const safeClose = () => {
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    } catch (e) {}

    // Garante limpeza do timer se fechar abruptamente
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    recorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    stopAllTracks();
    onRequestClose();
  };

  useEffect(() => {
    const startVideoPreview = async () => {
      setErrorMsg('');

      try {
        stopAllTracks();

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: true
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        setErrorMsg('Não foi possível acessar câmera/microfone. Verifique permissões do navegador.');
      }
    };

    if (isOpen && mode === 'video') {
      startVideoPreview();
    }

    if (!isOpen) {
      stopAllTracks();
      setIsRecording(false);
      // Limpeza extra ao fechar modal
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      recorderRef.current = null;
      chunksRef.current = [];
      setErrorMsg('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode]);

  // ===== FOTO =====
  // Ajuste: Processa a foto diretamente, sem render condicional no JSX
  const handleTakePhoto = async (dataUri) => {
    try {
      const res = await fetch(dataUri);
      const blob = await res.blob();
      onCapture(blob);
      safeClose();
    } catch (e) {
      console.error("Erro ao processar foto", e);
    }
  };

  // ===== VÍDEO =====
  const startRecording = () => {
    setErrorMsg('');

    if (!streamRef.current) {
      setErrorMsg('Stream não iniciado. Reabra o modal e tente novamente.');
      return;
    }

    try {
      chunksRef.current = [];

      const mimeType = pickSupportedMimeType();
      const recorder = new MediaRecorder(
        streamRef.current,
        mimeType ? { mimeType } : undefined
      );

      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // 1.3) Limpe o timer ao parar
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        try {
          const finalType = recorder.mimeType || 'video/webm';
          const blob = new Blob(chunksRef.current, { type: finalType });
          onCapture(blob);
        } catch (e) {}

        chunksRef.current = [];
        setIsRecording(false);
        safeClose();
      };

      recorder.start(250);
      setIsRecording(true);

      // 1.2) No startRecording, inicie o timer
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds(prev => {
          if (prev + 1 >= MAX_SECONDS) {
            // auto stop ao atingir o limite
            try {
              if (recorderRef.current && recorderRef.current.state !== 'inactive') {
                recorderRef.current.stop();
              }
            } catch (e) {}
            clearInterval(timerRef.current);
            return MAX_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      setErrorMsg('Seu navegador não suporta gravação de vídeo aqui (MediaRecorder).');
    }
  };

  const stopRecording = () => {
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    } catch (e) {
      setIsRecording(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={safeClose}
      style={customStyles}
    >
      <div style={toolbarStyle}>
        <button
          type="button"
          onClick={() => setMode('photo')}
          style={buttonStyle(mode === 'photo')}
          disabled={isRecording}
        >
          Foto
        </button>

        <button
          type="button"
          onClick={() => setMode('video')}
          style={buttonStyle(mode === 'video')}
          disabled={isRecording}
        >
          Vídeo
        </button>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={safeClose}
          style={buttonStyle(false)}
        >
          Fechar
        </button>
      </div>

      <div style={{ width: '100%', flex: 1, position: 'relative' }}>
        {mode === 'photo' && (
          <>
            <Camera
              onTakePhoto={handleTakePhoto}
              idealFacingMode={FACING_MODES.ENVIRONMENT}
              isImageMirror={false}
              style={customStyles}
            />
            {/* O bloco {capturedImage && handleConfirmPhoto()} foi removido para evitar tela branca */}
          </>
        )}

        {mode === 'video' && (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                background: 'rgba(0,0,0,0.4)'
              }}
            />

            {/* 1.4) Mostre o contador no modal */}
            <div
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                padding: '6px 10px',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.6)',
                color: '#fff',
                fontWeight: 700
              }}
            >
              {seconds}s / {MAX_SECONDS}s
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                gap: 12,
                padding: 10,
              }}
            >
              {!isRecording ? (
                <button type="button" onClick={startRecording} style={actionStyle(false)}>
                  Gravar
                </button>
              ) : (
                <button type="button" onClick={stopRecording} style={actionStyle(true)}>
                  Parar e Enviar
                </button>
              )}
            </div>

            {errorMsg && (
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  right: 12,
                  padding: 10,
                  borderRadius: 10,
                  background: 'rgba(220, 60, 60, 0.85)',
                  color: '#fff',
                  fontWeight: 600,
                  textAlign: 'center'
                }}
              >
                {errorMsg}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default CameraModal;