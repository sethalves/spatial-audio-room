//
//  Created by Ken Cooke on 3/11/22.
//  Copyright 2022 High Fidelity, Inc.
//
//  The contents of this file are PROPRIETARY AND CONFIDENTIAL, and may not be
//  used, disclosed to third parties, copied or duplicated in any form, in whole
//  or in part, without the prior written consent of High Fidelity, Inc.
//

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

registerProcessor('wasm-license', class extends AudioWorkletProcessor {

    constructor() {
        super();

        const tokenErrorString = [
            "TOKEN_VALID",
            "TOKEN_INVALID_LENGTH",
            "TOKEN_INVALID_HEADER",
            "TOKEN_INVALID_VERSION",
            "TOKEN_INVALID_SIGNATURE",
            "TOKEN_CLOCK_ROLLBACK",
            "TOKEN_EXPIRED"
        ];

        this.port.onmessage = (e) => {
            let code = Module.activate(e.data);
            console.log('[wasm-license] activate token:', e.data);
            console.log('[wasm-license] activate returned:', tokenErrorString[code]);
        }
    }

    process(inputs, outputs) { return true; }
})

registerProcessor('wasm-hrtf-input', class extends AudioWorkletProcessor {

    static get parameterDescriptors() {
        return [
            { name: 'gain', defaultValue: 0, automationRate: 'k-rate' },
            { name: 'azimuth', defaultValue: 0, automationRate: 'k-rate' },
            { name: 'distance', defaultValue: 1, automationRate: 'k-rate' },
            { name: 'lpfdist', defaultValue: 16, automationRate: 'k-rate' },
        ];
    }

    constructor() {
        super();

        this._hrtf = new Module.HrtfInput();

        this._inputBuffer = new WASMAudioBuffer(Module, NUM_FRAMES, 1, 1);  // mono
        this._outputBuffer = new WASMAudioBuffer(Module, NUM_FRAMES, 1, 1); // interleaved stereo, 1/2 sample rate
    }

    process(inputs, outputs, parameters) {

        // copy in
        if (inputs[0].length == 0) {
            this._inputBuffer.getF32Array().fill(0);
        } else {
            this._inputBuffer.getF32Array().set(inputs[0][0]);
        }

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

        this._inputBuffer = new WASMAudioBuffer(Module, NUM_FRAMES / 2, 2, 2);  // stereo, 1/2 sample rate
        this._outputBuffer = new WASMAudioBuffer(Module, NUM_FRAMES, 2, 2);     // stereo
    }

    process(inputs, outputs) {

        let inputPointer = [
            this._inputBuffer.getPointer(),
            this._inputBuffer.getPointer() + Float32Array.BYTES_PER_ELEMENT * NUM_FRAMES / 2
        ];
        let outputPointer = [
            this._outputBuffer.getPointer(),
            this._outputBuffer.getPointer() + Float32Array.BYTES_PER_ELEMENT * NUM_FRAMES
        ];

        // deinterleave in
        if (inputs[0].length == 0) {
            this._inputBuffer.getChannelData(0).fill(0);
            this._inputBuffer.getChannelData(1).fill(0);
        } else {
            deinterleave(inputs[0][0], this._inputBuffer._channelData, NUM_FRAMES / 2);
        }

        // process
        this._interpolate2[0].process(inputPointer[0], outputPointer[0], NUM_FRAMES / 2);
        this._interpolate2[1].process(inputPointer[1], outputPointer[1], NUM_FRAMES / 2);

        // copy out
        outputs[0][0].set(this._outputBuffer.getChannelData(0));
        outputs[0][1].set(this._outputBuffer.getChannelData(1));

        return true;
    }
})

registerProcessor('wasm-limiter', class extends AudioWorkletProcessor {

    constructor() {
        super();

        this._limiter = new Module.Limiter(sampleRate);

        this._inoutBuffer = new WASMAudioBuffer(Module, 2 * NUM_FRAMES, 1, 1);  // interleaved stereo
    }

    process(inputs, outputs) {

        // interleave in
        if (inputs[0].length == 0) {
            this._inoutBuffer.getF32Array().fill(0);
        } else {
            interleave(inputs[0], this._inoutBuffer.getF32Array(), NUM_FRAMES);
        }

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
            { name: 'threshold', defaultValue: -40, automationRate: 'k-rate' },
        ];
    }

    constructor() {
        super();

        this._noiseGate = new Module.NoiseGate(sampleRate);

        this._inoutBuffer = new WASMAudioBuffer(Module, NUM_FRAMES, 1, 1);  // mono
    }

    process(inputs, outputs, parameters) {

        // copy in
        if (inputs[0].length == 0) {
            this._inoutBuffer.getF32Array().fill(0);
        } else {
            this._inoutBuffer.getF32Array().set(inputs[0][0]);
        }

        // process (in-place)
        this._noiseGate.setThreshold(parameters.threshold[0]);
        this._noiseGate.process(this._inoutBuffer.getPointer(), this._inoutBuffer.getPointer(), NUM_FRAMES);

        // copy out
        outputs[0][0].set(this._inoutBuffer.getF32Array());

        return true;
    }
})
