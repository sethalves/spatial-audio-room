
import Module from './hifi.wasm.js';
import WASMAudioBuffer from './WASMAudioBuffer.js';

const NUM_FRAMES = 128;

function interleave(src, dst, N) {
    for (let i = 0; i < N; i++) {
        dst[2 * i + 0] = src[0][i];
        dst[2 * i + 1] = src[1][i];
    }
}

function deinterleave(src, dst, N) {
    for (let i = 0; i < N; i++) {
        dst[0][i] = src[2 * i + 0];
        dst[1][i] = src[2 * i + 1];
    }
}

registerProcessor('wasm-hrtf-input', class extends AudioWorkletProcessor {

    static get parameterDescriptors() {
        return [
            { name: 'gain', defaultValue: 0, minValue: -100, maxValue: 20, automationRate: 'k-rate' },
            { name: 'azimuth', defaultValue: 0, minValue: -Math.PI, maxValue: Math.PI, automationRate: 'k-rate' },
            { name: 'distance', defaultValue: 1, minValue: 0.125, maxValue: 65536, automationRate: 'k-rate' },
            { name: 'lpfdist', defaultValue: 16, minValue: 2, maxValue: 65536, automationRate: 'k-rate' },
        ];
    }

    constructor() {
        super();

        this._hrtf = new Module.HrtfInput();

        this._inputBuffer = new WASMAudioBuffer(Module, NUM_FRAMES, 1, 1);
        this._outputBuffer = new WASMAudioBuffer(Module, NUM_FRAMES, 1, 1);
    }

    process(inputs, outputs, parameters) {

        // copy in
        this._inputBuffer.getF32Array().set(inputs[0][0]);

        // process
        this._hrtf.setParameters(parameters.gain[0], parameters.azimuth[0], parameters.distance[0], parameters.lpfdist[0]);
        this._hrtf.process(this._inputBuffer.getPointer(), this._outputBuffer.getPointer());

        // copy out
        outputs[0][0].set(this._outputBuffer.getF32Array());

        return true;
    }
})

registerProcessor('wasm-hrtf-output', class extends AudioWorkletProcessor {

    constructor() {
        super();

        this._interpolate2 = [ new Module.Interpolate2(), new Module.Interpolate2() ];

        this._input = new WASMAudioBuffer(Module, NUM_FRAMES / 2, 2, 2);
        this._output = new WASMAudioBuffer(Module, NUM_FRAMES, 2, 2);
    }

    process(inputs, outputs) {

        if (inputs[0].length == 0) {
            outputs[0][0].fill(0);
            outputs[0][1].fill(0);    
            return true;
        }

        let inputPointer = [ 
            this._input.getPointer(), 
            this._input.getPointer() + Float32Array.BYTES_PER_ELEMENT * NUM_FRAMES / 2
        ];        
        let outputPointer = [ 
            this._output.getPointer(), 
            this._output.getPointer() + Float32Array.BYTES_PER_ELEMENT * NUM_FRAMES
        ];

        // deinterleave in
        deinterleave(inputs[0][0], this._input._channelData, NUM_FRAMES / 2);

        // process
        this._interpolate2[0].process(inputPointer[0], outputPointer[0], NUM_FRAMES / 2);
        this._interpolate2[1].process(inputPointer[1], outputPointer[1], NUM_FRAMES / 2);

        // copy out
        outputs[0][0].set(this._output.getChannelData(0));
        outputs[0][1].set(this._output.getChannelData(1));

        return true;
    }
})

registerProcessor('wasm-limiter', class extends AudioWorkletProcessor {
    
    constructor() {
        super();

        this._limiter = new Module.Limiter(sampleRate);

        // interleaved stereo buffer
        this._inoutBuffer = new WASMAudioBuffer(Module, 2 * NUM_FRAMES, 1, 1);
    }

    process(inputs, outputs) {

        // interleave in
        interleave(inputs[0], this._inoutBuffer.getF32Array(), NUM_FRAMES);

        // process (in-place)
        this._limiter.process(this._inoutBuffer.getPointer(), this._inoutBuffer.getPointer(), NUM_FRAMES);

        // deinterleave out
        deinterleave(this._inoutBuffer.getF32Array(), outputs[0], NUM_FRAMES);

        return true;
    }
})

registerProcessor('wasm-noise-gate', class extends AudioWorkletProcessor {

    static get parameterDescriptors() {
        return [
            { name: 'threshold', defaultValue: -40, minValue: -100, maxValue: 0, automationRate: 'k-rate' },
        ];
    }

    constructor() {
        super();

        this._noiseGate = new Module.NoiseGate(sampleRate);

        this._inoutBuffer = new WASMAudioBuffer(Module, NUM_FRAMES, 1, 1);
    }

    process(inputs, outputs, parameters) {

        // copy in
        this._inoutBuffer.getF32Array().set(inputs[0][0]);

        // process (in-place)
        this._noiseGate.setThreshold(parameters.threshold[0]);
        this._noiseGate.process(this._inoutBuffer.getPointer(), this._inoutBuffer.getPointer(), NUM_FRAMES);

        // copy out
        outputs[0][0].set(this._inoutBuffer.getF32Array());

        return true;
    }
})
