
;
const isChrome = !!(navigator.userAgent.indexOf("Chrome") !== -1);
const isSimdSupported = () => {
    const simdBlob = Uint8Array.from([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0,
        253, 15, 253, 98, 11]);
    const simdSupported = WebAssembly.validate(simdBlob);
    console.log('WebAssembly SIMD is ' + (simdSupported ? 'supported' : 'not supported') + ' by this browser.');
    return simdSupported;
};
const encodedTransformSupported = !!window.RTCRtpScriptTransform;
console.log('WebRTC Encoded Transform is ' + (encodedTransformSupported ? 'supported' : 'not supported') + ' by this browser.');
let _RTCPeerConnection = RTCPeerConnection;
function patchRTCPeerConnection(_RTCPeerConnection) {
    // patch RTCPeerConnection to enable insertable streams
    RTCPeerConnection = function (...config) {
        if (config.length)
            config[0].encodedInsertableStreams = true;
        return new _RTCPeerConnection(...config);
    };
}
patchRTCPeerConnection(_RTCPeerConnection);
let _RTCPeerConnectionWithMetadata = RTCPeerConnection;
let _RTCPeerConnectionWithoutMetadata = _RTCPeerConnection;

let listener;
let limiter;
let destination;
let setupHRTFOutputDone = false;
let worker = undefined;
async function setupHRTFOutput(audioContext, sourceMetadataCallback) {
    if (setupHRTFOutputDone)
        return destination;
    if (audioContext.sampleRate != 48000) {
        console.error("setupHRTFOutput requires an AudioContext sampleRate of 48000.");
    }
    if (encodedTransformSupported) {
        worker = new Worker('worker.js');
        worker.onmessage = event => sourceMetadataCallback(event.data.metadata, event.data.uid);
    }
    await audioContext.audioWorklet.addModule(isSimdSupported() ? 'hifi.wasm.simd.js' : 'hifi.wasm.js');
    // temporary license token that expires 1/1/2023
    const token = 'aGlmaQAAAAHLuJ9igD2xY0xxPKza+Rcw9gQGOo8T5k+/HJpF/UR1k99pVS6n6QfyWTz1PTHkpt62tta3jn0Ntbdx73ah/LBv14T1HjJULQE=';
    let hifiLicense = new AudioWorkletNode(audioContext, 'wasm-license');
    hifiLicense.port.postMessage(token);
    // Set up a series of webaudio worklets.  New sources will connect to the listener, the first in this chain.
    // HRTFInput(s) --> listener --> limiter --> destination
    listener = new AudioWorkletNode(audioContext, 'wasm-hrtf-output', { outputChannelCount: [2] });
    limiter = new AudioWorkletNode(audioContext, 'wasm-limiter', { outputChannelCount: [2] });
    destination = audioContext.createMediaStreamDestination();
    listener.connect(limiter);
    limiter.connect(destination);
    setupHRTFOutputDone = true;
    return destination;
}
function shutdownHRTFOutput(audioContext) {
    if (!setupHRTFOutputDone)
        return;
    listener = null;
    limiter = null;
    destination = null;
    worker && worker.terminate();
    setupHRTFOutputDone = false;
}
function getHRTFOutput() {
    if (!setupHRTFOutputDone) {
        console.error("call setupHRTFOutput before using getHRTFOutput.");
    }
    return destination;
}
class NoiseGate extends AudioWorkletNode {
    constructor(audioContext) {
        if (!setupHRTFOutputDone) {
            console.error("call setupHRTFOutput before creating NoiseGate nodes.");
        }
        super(audioContext, 'wasm-noise-gate');
    }
    setThreshold(value) {
        this.parameters.get('threshold').value = value;
    }
}
class HRTFInput extends AudioWorkletNode {
    constructor(audioContext) {
        if (!setupHRTFOutputDone)
            console.error("call setupHRTFOutput before creating HRTFInput nodes.");
        super(audioContext, 'wasm-hrtf-input');
        this.connect(listener);
    }
    disconnect() {
        super.disconnect();
    }
    setPosition(azimuth, distance) {
        if (azimuth === azimuth) {
            this.parameters.get('azimuth').value = azimuth;
        }
        if (distance === distance) {
            this.parameters.get('distance').value = distance;
        }
    }
}
function listenerMetadata(position) {
    let data = new DataView(new ArrayBuffer(5));
    let qx = Math.round(position.x * 256.0); // x in Q7.8
    let qy = Math.round(position.y * 256.0); // y in Q7.8
    let qo = Math.round(position.o * (128.0 / Math.PI)); // brad in Q7
    data.setInt16(0, qx);
    data.setInt16(2, qy);
    data.setInt8(4, qo);
    if (encodedTransformSupported) {
        worker.postMessage({
            operation: 'metadata',
            metadata: data.buffer
        }, [data.buffer]);
    }
    else {
        metadata.data = data.buffer;
    }
}
function setupSenderMetadata(sender) {
    if (encodedTransformSupported) {
        // Encoded Transform
        sender.transform = new RTCRtpScriptTransform(worker, { operation: 'sender' });
    }
    else {
        // Insertable Streams
        const senderStreams = sender.createEncodedStreams();
        const readableStream = senderStreams.readable;
        const writableStream = senderStreams.writable;
        senderTransform(readableStream, writableStream);
    }
}
function setupReceiverMetadata(receiver, uid, sourceMetadataCallback) {
    if (encodedTransformSupported) {
        // Encoded Transform
        receiver.transform = new RTCRtpScriptTransform(worker, { operation: 'receiver', uid });
    }
    else {
        // Insertable Streams
        const receiverStreams = receiver.createEncodedStreams();
        const readableStream = receiverStreams.readable;
        const writableStream = receiverStreams.writable;
        receiverTransform(readableStream, writableStream, uid, sourceMetadataCallback);
    }
}
//# sourceMappingURL=hifi-audio.js.map