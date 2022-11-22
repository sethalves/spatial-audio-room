const isChrome = !!(navigator.userAgent.indexOf("Chrome") !== -1);
const isSimdSupported = () => {
    const simdBlob = Uint8Array.from([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0,
        253, 15, 253, 98, 11]);
    const simdSupported = WebAssembly.validate(simdBlob);
    console.log('WebAssembly SIMD is ' + (simdSupported ? 'supported' : 'not supported') + ' by this browser.');
    return simdSupported;
};
let listener;
let limiter;
let destination;
let setupHRTFOutputDone = false;
async function setupHRTFOutput(audioContext) {
    if (setupHRTFOutputDone)
        return destination;
    if (audioContext.sampleRate != 48000) {
        console.error("setupHRTFOutput requires an AudioContext sampleRate of 48000.");
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
    setupHRTFOutputDone = false;
}
function getHRTFOutput() {
    if (!setupHRTFOutputDone) {
        console.error("call setupHRTFOutput before using getHRTFOutput.");
    }
    return destination;
}
class HRTFInput extends AudioWorkletNode {
    constructor(audioContext) {
        super(audioContext, 'wasm-hrtf-input');
        if (!setupHRTFOutputDone)
            console.error("call setupHRTFOutput before creating HRTFInput nodes.");
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
//# sourceMappingURL=hifi-audio.js.map
