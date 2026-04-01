import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

export default function ScanInput({
    onScan,
    label = 'Scan Barcode / QR',
    placeholder = 'Scan or type code then press Enter',
    clearSignal = 0,
    clearOnScan = false,
}) {
    const [value, setValue] = useState('');
    const [cameraOpen, setCameraOpen] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [cameraLoading, setCameraLoading] = useState(false);
    const videoRef = useRef(null);
    const controlsRef = useRef(null);
    const readerRef = useRef(null);
    const scannedRecentlyRef = useRef(false);

    const stopCamera = () => {
        if (controlsRef.current) {
            controlsRef.current.stop();
            controlsRef.current = null;
        }
        if (videoRef.current?.srcObject) {
            const tracks = videoRef.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setCameraOpen(false);
        setCameraLoading(false);
    };

    useEffect(() => {
        return () => stopCamera();
    }, []);

    useEffect(() => {
        setValue('');
        setCameraError('');
        stopCamera();
    }, [clearSignal]);

    const emitScan = (raw) => {
        const scanned = String(raw || '').trim();
        if (!scanned) return;
        scannedRecentlyRef.current = true;
        setValue(scanned);
        setCameraError('');
        onScan(scanned);
        if (clearOnScan) setValue('');
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        emitScan(value);
    };

    const startCamera = async () => {
        setCameraError('');
        setCameraLoading(true);
        scannedRecentlyRef.current = false;
        try {
            if (!readerRef.current) readerRef.current = new BrowserMultiFormatReader();
            setCameraOpen(true);
            await new Promise(resolve => setTimeout(resolve, 0));
            if (!videoRef.current) {
                setCameraError('Camera preview failed to initialize. Please try again.');
                return;
            }

            if (!window.isSecureContext) {
                setCameraError('Camera requires a secure context (https or localhost).');
                stopCamera();
                return;
            }
            if (!navigator.mediaDevices?.getUserMedia) {
                setCameraError('This browser does not support camera access.');
                stopCamera();
                return;
            }

            const devices = await BrowserMultiFormatReader.listVideoInputDevices();
            if (!devices.length) {
                setCameraError('No camera found on this device.');
                stopCamera();
                return;
            }

            const picked = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[0];
            controlsRef.current = await readerRef.current.decodeFromVideoDevice(picked.deviceId, videoRef.current, (result, err) => {
                if (result?.getText()) {
                    emitScan(result.getText());
                    stopCamera();
                } else if (err && err.name !== 'NotFoundException' && !scannedRecentlyRef.current) {
                    setCameraError('Camera scan failed. Try hardware scan or manual entry.');
                }
            });
        } catch (err) {
            if (err?.name === 'NotAllowedError') {
                setCameraError('Camera permission denied. Allow camera access in your browser settings.');
            } else if (err?.name === 'NotReadableError') {
                setCameraError('Camera is busy (used by another app). Close that app and try again.');
            } else {
                setCameraError('Unable to access camera. Check browser camera permissions.');
            }
            stopCamera();
        } finally {
            setCameraLoading(false);
        }
    };

    return (
        <div style={styles.card}>
            <label style={styles.label}>{label}</label>
            <form onSubmit={handleSubmit} style={styles.row}>
                <input
                    style={styles.input}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                />
                <button type="submit" style={styles.btn}>Use</button>
            </form>
            <div style={styles.row}>
                <button type="button" onClick={cameraOpen ? stopCamera : startCamera} style={styles.secondaryBtn} disabled={cameraLoading}>
                    {cameraLoading ? 'Starting...' : cameraOpen ? 'Stop Camera' : 'Open Camera Scanner'}
                </button>
            </div>
            {cameraError && <div style={styles.error}>⚠️ {cameraError}</div>}
            <div style={{ ...styles.videoWrap, display: cameraOpen ? 'block' : 'none' }}>
                <video ref={videoRef} style={styles.video} muted playsInline />
            </div>
            <div style={styles.hint}>Works with hardware scanners too: focus the input and scan.</div>
        </div>
    );
}

const styles = {
    card: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, marginBottom: 14 },
    label: { display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#334155' },
    row: { display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' },
    input: { flex: 1, width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14, boxSizing: 'border-box' },
    btn: { border: 'none', background: '#1E40AF', color: 'white', borderRadius: 8, padding: '9px 14px', cursor: 'pointer', fontWeight: 600 },
    secondaryBtn: { border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
    error: { marginTop: 6, color: '#DC2626', fontSize: 12 },
    hint: { color: '#64748B', fontSize: 12 },
    videoWrap: { borderRadius: 8, overflow: 'hidden', border: '1px solid #CBD5E1', marginBottom: 8, background: '#0F172A' },
    video: { width: '100%', maxHeight: 220, display: 'block' },
};
