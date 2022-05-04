
'use strict';

export function checkSupported() {

    const simdBlob = Uint8Array.from([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
    const simdSupported = WebAssembly.validate(simdBlob);
    console.log('WebAssembly SIMD is ' + (simdSupported ? 'supported' : 'not supported') + ' by this browser.');

    const encodedTransformSupported = !!window.RTCRtpScriptTransform;
    console.log('WebRTC Encoded Transform is ' + (encodedTransformSupported ? 'supported' : 'not supported') + ' by this browser.');

    return [simdSupported, encodedTransformSupported, !!window.chrome];
}
