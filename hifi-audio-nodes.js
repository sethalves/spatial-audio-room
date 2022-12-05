var HiFiAudioNodes;
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/transform.ts":
/*!**************************!*\
  !*** ./src/transform.ts ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "metadata": () => (/* binding */ metadata),
/* harmony export */   "receiverTransform": () => (/* binding */ receiverTransform),
/* harmony export */   "senderTransform": () => (/* binding */ senderTransform)
/* harmony export */ });
//
//  Created by Ken Cooke on 3/11/22.
//  Copyright 2022 High Fidelity, Inc.
//
//  The contents of this file are PROPRIETARY AND CONFIDENTIAL, and may not be
//  used, disclosed to third parties, copied or duplicated in any form, in whole
//  or in part, without the prior written consent of High Fidelity, Inc.
//

const METADATA_BYTES = 5;
let metadata = {
    data: new Uint8Array(METADATA_BYTES)
};
function senderTransform(readableStream, writableStream) {
    const transformStream = new TransformStream({
        start() { console.log('%cworker set sender transform', 'color:yellow'); },
        transform(encodedFrame, controller) {
            let src = new Uint8Array(encodedFrame.data);
            let len = encodedFrame.data.byteLength;
            // create dst buffer with METADATA_BYTES extra bytes
            let dst = new Uint8Array(len + METADATA_BYTES);
            // copy src data
            for (let i = 0; i < len; ++i) {
                dst[i] = src[i];
            }
            // insert metadata at the end
            let data = new Uint8Array(metadata.data);
            for (let i = 0; i < METADATA_BYTES; ++i) {
                dst[len + i] = data[i];
            }
            encodedFrame.data = dst.buffer;
            controller.enqueue(encodedFrame);
        },
    });
    readableStream.pipeThrough(transformStream).pipeTo(writableStream);
}
function receiverTransform(readableStream, writableStream, uid, sourceMetadata) {
    const transformStream = new TransformStream({
        start() { console.log('%cworker set receiver transform for uid:', 'color:yellow', uid); },
        transform(encodedFrame, controller) {
            let src = new Uint8Array(encodedFrame.data);
            let len = encodedFrame.data.byteLength;
            if (len < METADATA_BYTES) {
                console.log('%cWARNING: receiver transform has no metadata! uid:', 'color:yellow', uid);
                controller.enqueue(encodedFrame);
            }
            else {
                // create dst buffer with METADATA_BYTES fewer bytes
                len -= METADATA_BYTES;
                let dst = new Uint8Array(len);
                // copy src data
                for (let i = 0; i < len; ++i) {
                    dst[i] = src[i];
                }
                // extract metadata at the end
                let data = new Uint8Array(METADATA_BYTES);
                for (let i = 0; i < METADATA_BYTES; ++i) {
                    data[i] = src[len + i];
                }
                sourceMetadata(data.buffer, uid);
                encodedFrame.data = dst.buffer;
                controller.enqueue(encodedFrame);
            }
        },
    });
    transformStream.uid = uid;
    readableStream.pipeThrough(transformStream).pipeTo(writableStream);
}


/***/ }),

/***/ "./src/hifi.wasm.js":
/*!**************************!*\
  !*** ./src/hifi.wasm.js ***!
  \**************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "16738048d82eb804613f.js";

/***/ }),

/***/ "./src/hifi.wasm.simd.js":
/*!*******************************!*\
  !*** ./src/hifi.wasm.simd.js ***!
  \*******************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "04d3dc78f966c19a413d.js";

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/global */
/******/ 	(() => {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/publicPath */
/******/ 	(() => {
/******/ 		var scriptUrl;
/******/ 		if (__webpack_require__.g.importScripts) scriptUrl = __webpack_require__.g.location + "";
/******/ 		var document = __webpack_require__.g.document;
/******/ 		if (!scriptUrl && document) {
/******/ 			if (document.currentScript)
/******/ 				scriptUrl = document.currentScript.src
/******/ 			if (!scriptUrl) {
/******/ 				var scripts = document.getElementsByTagName("script");
/******/ 				if(scripts.length) scriptUrl = scripts[scripts.length - 1].src
/******/ 			}
/******/ 		}
/******/ 		// When supporting browsers where an automatic publicPath is not supported you must specify an output.publicPath manually via configuration
/******/ 		// or pass an empty string ("") and set the __webpack_public_path__ variable from your code to use your own logic.
/******/ 		if (!scriptUrl) throw new Error("Automatic publicPath is not supported in this browser");
/******/ 		scriptUrl = scriptUrl.replace(/#.*$/, "").replace(/\?.*$/, "").replace(/\/[^\/]+$/, "/");
/******/ 		__webpack_require__.p = scriptUrl;
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/jsonp chunk loading */
/******/ 	(() => {
/******/ 		__webpack_require__.b = document.baseURI || self.location.href;
/******/ 		
/******/ 		// object to store loaded and loading chunks
/******/ 		// undefined = chunk not loaded, null = chunk preloaded/prefetched
/******/ 		// [resolve, reject, Promise] = chunk loading, 0 = chunk loaded
/******/ 		var installedChunks = {
/******/ 			"bundle": 0
/******/ 		};
/******/ 		
/******/ 		// no chunk on demand loading
/******/ 		
/******/ 		// no prefetching
/******/ 		
/******/ 		// no preloaded
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 		
/******/ 		// no on chunks loaded
/******/ 		
/******/ 		// no jsonp function
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!***************************!*\
  !*** ./src/hifi-audio.ts ***!
  \***************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "HRTFInput": () => (/* binding */ HRTFInput),
/* harmony export */   "HRTFOutput": () => (/* binding */ HRTFOutput),
/* harmony export */   "Limiter": () => (/* binding */ Limiter),
/* harmony export */   "NoiseGate": () => (/* binding */ NoiseGate),
/* harmony export */   "setupHRTF": () => (/* binding */ setupHRTF),
/* harmony export */   "setupReceiverMetadata": () => (/* binding */ setupReceiverMetadata),
/* harmony export */   "setupSenderMetadata": () => (/* binding */ setupSenderMetadata),
/* harmony export */   "shutdownHRTF": () => (/* binding */ shutdownHRTF)
/* harmony export */ });
/* harmony import */ var _transform_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./transform.js */ "./src/transform.ts");
/**
   # HifiAudioNodes

   hifi-audio-nodes provides several {@link https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API | Web Audio} compatible nodes.

   ![WebAudio Nodes](/sdocs/High-Fidelity-Audio-Engine.png)

   Start by creating an AudioContext with a sampleRate of 48000.

   Call {@link setupHRTF} to load needed WASM modules.

   Once {@link setupHRTF} is done, {@link HRTFInput}s can be created, as needed.  Each {@link HRTFInput} should be connected
   to the singleton {@link HRTFOutput} node.  The position (relative to the Listener) of an {@link HRTFInput} can be set with
   {@link HRTFInput.setPosition}.

   # Metadata

   This library modifies {@link RTCPeerConnection}s so they are created with {@link encodedInsertableStreams} set to `true`.
   If {@link setupHRTF} is called with a non-null {@link setRemoteSourcePositionUpdate} parameter, metadata is enabled.  The 2D position of
   local audio-sources will be combined with transmitted audio-data, and audio-data from remote sources will contain
   their respective positions.

   To connect the metadata encoders and decoders, call {@link setupSenderMetadata} on any {@link RTCRtpSender}s created,
   and call {@link setupReceiverMetadata} on any {@link RTCRtpReceiver}s. To transmit the position of the local listener,
   call {@link setPosition}.  When the position of a remote source changes, the function given to {@link setupHRTF}
   is called-back.

   Use shutdownHRTF to clean up.

   @module HiFiAudioNodes
*/
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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

let setupHRTFtDone = false;
let worker = undefined;
let remoteSourcePositionUpdate = undefined;
function sourceMetadataCallback(buffer, uid) {
    if (remoteSourcePositionUpdate) {
        let data = new DataView(buffer);
        let x = data.getInt16(0) * (1 / 256.0);
        let y = data.getInt16(2) * (1 / 256.0);
        let o = data.getInt8(4) * (Math.PI / 128.0);
        remoteSourcePositionUpdate(uid, x, y, o);
    }
}
/**
   Call {@link setupHRTF} to load and initialize WASM modules

   @example
   ``` typescript
   function remoteSourceMoved(uid, x, y, o) {
       // ...
   }

   await setupHRTF(audioContext, remoteSourceMoved);
   let listener = new HRTFOutput(audioContext);
   let limiter = new Limiter(audioContext);
   let dst = audioContext.createMediaStreamDestination();
   listener.connect(limiter).connect(dst);
   let audioElement = new Audio();
   audioElement.srcObject = dst.stream;
   audioElement.play();
   ```

   @param {AudioContext} audioContext - The AudioContext to use.  It should be created with a sample-rate of 48000.
   @param {Function} setRemoteSourcePositionUpdate - A callback function for when remote Sources change their position.  The callback takes parameters `(uid : string, x : number, y : number, o : number)`.  The `uid` is from a previous call to `setupReceiverMetadata`.  `x` and `y` are in meters, `o` is in radians.
*/
function setupHRTF(audioContext, setRemoteSourcePositionUpdate) {
    return __awaiter(this, void 0, void 0, function* () {
        if (setupHRTFtDone) {
            console.error("don't call setupHRTF twice without shutdownHRTF in between.");
            return;
        }
        remoteSourcePositionUpdate = setRemoteSourcePositionUpdate;
        if (audioContext.sampleRate != 48000) {
            console.error("setupHRTF requires an AudioContext sampleRate of 48000.");
        }
        if (encodedTransformSupported) {
            worker = new Worker('./worker.js');
            // worker = new Worker(new URL('./worker.js', import.meta.url));
            worker.onmessage = event => sourceMetadataCallback(event.data.metadata, event.data.uid);
        }
        const wasmsimdURL = new URL(/* asset import */ __webpack_require__(/*! ./hifi.wasm.simd.js */ "./src/hifi.wasm.simd.js"), __webpack_require__.b);
        const wasmURL = new URL(/* asset import */ __webpack_require__(/*! ./hifi.wasm.js */ "./src/hifi.wasm.js"), __webpack_require__.b);
        yield audioContext.audioWorklet.addModule(isSimdSupported() ? wasmsimdURL.toString() : wasmURL.toString());
        // temporary license token that expires 4/1/2023
        const token = 'aGlmaQAAAAEYz35jcNYnZI0LwfP1YNks43UjAVUbXpOK0gujFdSvElI1sM4jzCAkKXnkZlP65MoopYehBewn2aZI01ja6ej1edr+MRmFYwc=';
        let hifiLicense = new AudioWorkletNode(audioContext, 'wasm-license');
        hifiLicense.port.postMessage(token);
        setupHRTFtDone = true;
    });
}
/**
   Free resources consumed by {@link setupHRTF}.
*/
function shutdownHRTF() {
    if (!setupHRTFtDone) {
        console.error("shutdownHRTF called before setupHRTF");
        return;
    }
    worker && worker.terminate();
    remoteSourcePositionUpdate = undefined;
    setupHRTFtDone = false;
}
/**
   A NoiseGate node is intended to sit between a microphone and a sending WebRTC connection.  It will suppress audio
   at levels below the adjustable threshold.  Use of a NoiseGate node can help remove background noise and
   reduce network bandwidth used to send audio.  {@link setupHRTF} should be called before creating a {@link NoiseGate} node.

   @class
   @example
   ```typescript
   let noiseGate = new NoiseGate(audioContext);
   if (muted) {
       noiseGate.setThreshold(0);
   } else {
       noiseGate.setThreshold(-40);
   }
   let sourceNode = audioContext.createMediaStreamSource(mediaStream);
   sourceNode.connect(noiseGate).connect(destinationNode);
   ```
*/
class NoiseGate extends AudioWorkletNode {
    /**
       @param {AudioContext} audioContext - The AudioContext to use.  It should be created with a sample-rate of 48000.
    */
    constructor(audioContext) {
        if (!setupHRTFtDone) {
            console.error("call setupHRTF before creating NoiseGate nodes.");
        }
        super(audioContext, 'wasm-noise-gate', { channelCountMode: "explicit", channelCount: 1 });
    }
    /**
       @param value - A negative value between -80 and 0 which indicates a minimum decible level for the noise-gate
       to stop suppressing audio.
     */
    setThreshold(value) {
        this.parameters.get('threshold').value = value;
    }
}
/**
   HRTFOutput represents the Listener.  Sources ({@link HRTFInput}s) are arranged around this to create spatialized audio.
   

   @example
   ```typescript
   let listener = new HRTFOutput(audioContext);
   let limiter = new Limiter(audioContext);
   let destination = audioContext.createMediaStreamDestination();
   listener.connect(limiter).connect(destination);
   ```
*/
class HRTFOutput extends AudioWorkletNode {
    /**
       @param {AudioContext} audioContext - The AudioContext to use.  It should be created with a sample-rate of 48000.
    */
    constructor(audioContext) {
        if (!setupHRTFtDone) {
            console.error("call setupHRTF before creating an HRTFOutput node.");
        }
        super(audioContext, 'wasm-hrtf-output', { outputChannelCount: [2] });
    }
    /**
       Call setPosition to update the local Listener's position within the virtual audio space.
       The position will be sent over the WebRTC PeerConnection along with audio-data.  This function
       can only be used if setupHRTF was called with a non-null MetadataCallback function.

       @param {MetaData} position - an associative array with members `x`, `y`, and `o` to indicate the position
       of the local Listener.  `x` and `y` are in meters, and `o` is in radians.

       @example
       ```typescript
       let md = {};
       md.x = 1.5;
       md.y = -2;
       md.o = 0.785;
       listener.setPosition(md);
       ```
    */
    setPosition(position) {
        if (!setupHRTFtDone) {
            console.error("call setupHRTF before using setPosition");
            return;
        }
        if (!remoteSourcePositionUpdate) {
            console.error("setPosition can't be used with null remoteSourcePositionUpdate");
            return;
        }
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
            _transform_js__WEBPACK_IMPORTED_MODULE_0__.metadata.data = data.buffer;
        }
    }
}
/**
   Limiter node is used to convert high dynamic range audio into 16bit audio for transmission over a WebRTC connection.

   @example
   ```typescript
   let listener = new HRTFOutput(audioContext);
   let limiter = new Limiter(audioContext);
   let destination = audioContext.createMediaStreamDestination();
   listener.connect(limiter).connect(destination);
   ```
*/
class Limiter extends AudioWorkletNode {
    /**
       @param {AudioContext} audioContext - The AudioContext to use.  It should be created with a sample-rate of 48000.
    */
    constructor(audioContext) {
        if (!setupHRTFtDone) {
            console.error("call setupHRTF before creating a Limiter node.");
        }
        super(audioContext, 'wasm-limiter', { outputChannelCount: [2] });
    }
}
/**
   HRTFInput represents a spatialized audio-source being heard by the Listener / HRTFOutput node.  The audio-source can
   be a local source, or one recieved over WebRTC.

   @class
   @example
   ```typescript
    let sourceNode = new AudioBufferSourceNode(audioContext);
    sourceNode.buffer = audioBuffer;
    sourceNode.loop = true;
    let hrtfInput = new HRTFInput(audioContext);
    sourceNode.connect(hrtfInput);
    ```
    ```typescript
    let mediaStreamTrack = audioTrack.getMediaStreamTrack();
    let mediaStream = new MediaStream([mediaStreamTrack]);
    let sourceNode = audioContext.createMediaStreamSource(mediaStream);
    let hrtfInput = new HRTFInput(audioContext);
    sourceNode.connect(hrtfInput);
   ```
*/
class HRTFInput extends AudioWorkletNode {
    /**
       @param {AudioContext} audioContext - The AudioContext to use.  It should be created with a sample-rate of 48000.
    */
    constructor(audioContext) {
        if (!setupHRTFtDone)
            console.error("call setupHRTF before creating HRTFInput nodes.");
        super(audioContext, 'wasm-hrtf-input', { channelCountMode: "explicit", channelCount: 1 });
    }
    /**
       Disconnect this Web Audio node from other nodes.
     */
    disconnect() {
        super.disconnect();
    }
    /**
       Set the position of this audio-source relative to the Listener.

       @param azimuth - angle in radians measured between the direction the Listener is facing and the direction to the Source.
       @param distance - the Source's distance from the Listener in meters.

       ![WebAudio Nodes](/sdocs/Azimuth-and-Distance-Diagram.png)
     */
    setPosition(azimuth, distance) {
        if (azimuth === azimuth) {
            this.parameters.get('azimuth').value = azimuth;
        }
        if (distance === distance) {
            this.parameters.get('distance').value = distance;
        }
    }
}
/**
   When metadata is enabled, call {@link setupSenderMetadata} to install an encoders in {@link RTCRtpSender}s.  This will install
   either a RTCRtpScriptTransform (Safari) or use Insertable Streams (Chrome) to inject position information
   into transmitted audio-data.

   @example
   ```typescript
   let senders = peerConnection.getSenders();
   let sender = senders.find(e => e.track?.kind === 'audio');
   setupSenderMetadata(sender);

   ```

   @param sender - an RTCRtpSender in which to install a position encoder.
*/
function setupSenderMetadata(sender) {
    if (!setupHRTFtDone) {
        console.error("call setupHRTF before using setupSenderMetadata");
        return;
    }
    if (!remoteSourcePositionUpdate) {
        console.error("setupSenderMetadata can't be used with null remoteSourcePositionUpdate");
        return;
    }
    if (encodedTransformSupported) {
        // Encoded Transform
        sender.transform = new RTCRtpScriptTransform(worker, { operation: 'sender' });
    }
    else {
        // Insertable Streams
        const senderStreams = sender.createEncodedStreams();
        const readableStream = senderStreams.readable;
        const writableStream = senderStreams.writable;
        (0,_transform_js__WEBPACK_IMPORTED_MODULE_0__.senderTransform)(readableStream, writableStream);
    }
}
/**
   When metadata is enabled, call {@link setupReceiverMetadata} to install decoders in {@link RTCRtpReceiver}s.  This will install
   either a RTCRtpScriptTransform (Safari) or use Insertable Streams (Chrome) to extract position information
   from transmitted audio-data.  When position information is extracted, the {@link RemoteSourcePositionUpdate} callback
   passed to {@link setupHRTF} will be called.

   @example
   ```typescript
   let trackId = ...;
   let receivers = peerConnection.getReceivers();
   let receiver = receivers.find(e => e.track?.id === trackId && e.track?.kind === 'audio');
   setupReceiverMetadata(receiver, uid);
   ```

   @param receiver - an RTCRtpReceiver in which to install a position decoder.
   @param uid - a string used to identify this particular RTCRtpReceiver.  When the `RemoteSourcePositionUpdate` callback is called, this string will be passed as the first parameter.
*/
function setupReceiverMetadata(receiver, uid) {
    if (!setupHRTFtDone) {
        console.error("call setupHRTF before using setupReceiverMetadata");
        return;
    }
    if (!remoteSourcePositionUpdate) {
        console.error("setupReceiverMetadata can't be used with null remoteSourcePositionUpdate");
        return;
    }
    if (encodedTransformSupported) {
        // Encoded Transform
        receiver.transform = new RTCRtpScriptTransform(worker, { operation: 'receiver', uid });
    }
    else {
        // Insertable Streams
        const receiverStreams = receiver.createEncodedStreams();
        const readableStream = receiverStreams.readable;
        const writableStream = receiverStreams.writable;
        (0,_transform_js__WEBPACK_IMPORTED_MODULE_0__.receiverTransform)(readableStream, writableStream, uid, sourceMetadataCallback);
    }
}

})();

HiFiAudioNodes = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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bUQsQ0FBQyxDQUFDO1FBQ25FLE9BQU87S0FDVjtJQUVELElBQUksQ0FBQywwQkFBMEIsRUFBRTtRQUM3QixPQUFPLENBQUMsS0FBSyxDQUFDLDBFQUEwRSxDQUFDLENBQUM7UUFDMUYsT0FBTztLQUNWO0lBRUQsSUFBSSx5QkFBeUIsRUFBRTtRQUMzQixvQkFBb0I7UUFDcEIsUUFBUSxDQUFDLFNBQVMsR0FBRyxJQUFJLHFCQUFxQixDQUFDLE1BQU0sRUFBRSxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztLQUUxRjtTQUFNO1FBQ0gscUJBQXFCO1FBQ3JCLE1BQU0sZUFBZSxHQUFHLFFBQVEsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1FBQ3hELE1BQU0sY0FBYyxHQUFHLGVBQWUsQ0FBQyxRQUFRLENBQUM7UUFDaEQsTUFBTSxjQUFjLEdBQUcsZUFBZSxDQUFDLFFBQVEsQ0FBQztRQUNoRCxnRUFBaUIsQ0FBQyxjQUFjLEVBQUUsY0FBYyxFQUFFLEdBQUcsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO0tBQ2xGO0FBQ0wsQ0FBQyIsInNvdXJjZXMiOlsid2VicGFjazovL0hpRmlBdWRpb05vZGVzLy4vc3JjL3RyYW5zZm9ybS50cyIsIndlYnBhY2s6Ly9IaUZpQXVkaW9Ob2Rlcy93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly9IaUZpQXVkaW9Ob2Rlcy93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vSGlGaUF1ZGlvTm9kZXMvd2VicGFjay9ydW50aW1lL2dsb2JhbCIsIndlYnBhY2s6Ly9IaUZpQXVkaW9Ob2Rlcy93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL0hpRmlBdWRpb05vZGVzL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vSGlGaUF1ZGlvTm9kZXMvd2VicGFjay9ydW50aW1lL3B1YmxpY1BhdGgiLCJ3ZWJwYWNrOi8vSGlGaUF1ZGlvTm9kZXMvd2VicGFjay9ydW50aW1lL2pzb25wIGNodW5rIGxvYWRpbmciLCJ3ZWJwYWNrOi8vSGlGaUF1ZGlvTm9kZXMvLi9zcmMvaGlmaS1hdWRpby50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvL1xuLy8gIENyZWF0ZWQgYnkgS2VuIENvb2tlIG9uIDMvMTEvMjIuXG4vLyAgQ29weXJpZ2h0IDIwMjIgSGlnaCBGaWRlbGl0eSwgSW5jLlxuLy9cbi8vICBUaGUgY29udGVudHMgb2YgdGhpcyBmaWxlIGFyZSBQUk9QUklFVEFSWSBBTkQgQ09ORklERU5USUFMLCBhbmQgbWF5IG5vdCBiZVxuLy8gIHVzZWQsIGRpc2Nsb3NlZCB0byB0aGlyZCBwYXJ0aWVzLCBjb3BpZWQgb3IgZHVwbGljYXRlZCBpbiBhbnkgZm9ybSwgaW4gd2hvbGVcbi8vICBvciBpbiBwYXJ0LCB3aXRob3V0IHRoZSBwcmlvciB3cml0dGVuIGNvbnNlbnQgb2YgSGlnaCBGaWRlbGl0eSwgSW5jLlxuLy9cblxuJ3VzZSBzdHJpY3QnO1xuXG5pbnRlcmZhY2UgVHJhbnNmb3JtU3RyZWFtV2l0aElEIGV4dGVuZHMgVHJhbnNmb3JtU3RyZWFtIHtcbiAgICB1aWQ/IDogc3RyaW5nIHwgdW5kZWZpbmVkXG59XG5cbmNvbnN0IE1FVEFEQVRBX0JZVEVTID0gNTtcbmV4cG9ydCBsZXQgbWV0YWRhdGEgOiBNZXRhZGF0YUJvdW5jZUJ1ZmZlciA9IHtcbiAgICBkYXRhOiBuZXcgVWludDhBcnJheShNRVRBREFUQV9CWVRFUylcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBzZW5kZXJUcmFuc2Zvcm0ocmVhZGFibGVTdHJlYW0gOiBSZWFkYWJsZVN0cmVhbSwgd3JpdGFibGVTdHJlYW0gOiBXcml0YWJsZVN0cmVhbSkgOiB2b2lkIHtcbiAgICBjb25zdCB0cmFuc2Zvcm1TdHJlYW0gPSBuZXcgVHJhbnNmb3JtU3RyZWFtKHtcbiAgICAgICAgc3RhcnQoKSB7IGNvbnNvbGUubG9nKCclY3dvcmtlciBzZXQgc2VuZGVyIHRyYW5zZm9ybScsICdjb2xvcjp5ZWxsb3cnKTsgfSxcbiAgICAgICAgdHJhbnNmb3JtKGVuY29kZWRGcmFtZSwgY29udHJvbGxlcikge1xuXG4gICAgICAgICAgICBsZXQgc3JjID0gbmV3IFVpbnQ4QXJyYXkoZW5jb2RlZEZyYW1lLmRhdGEpO1xuICAgICAgICAgICAgbGV0IGxlbiA9IGVuY29kZWRGcmFtZS5kYXRhLmJ5dGVMZW5ndGg7XG5cbiAgICAgICAgICAgIC8vIGNyZWF0ZSBkc3QgYnVmZmVyIHdpdGggTUVUQURBVEFfQllURVMgZXh0cmEgYnl0ZXNcbiAgICAgICAgICAgIGxldCBkc3QgPSBuZXcgVWludDhBcnJheShsZW4gKyBNRVRBREFUQV9CWVRFUyk7XG5cbiAgICAgICAgICAgIC8vIGNvcHkgc3JjIGRhdGFcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgICAgICAgICBkc3RbaV0gPSBzcmNbaV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGluc2VydCBtZXRhZGF0YSBhdCB0aGUgZW5kXG4gICAgICAgICAgICBsZXQgZGF0YSA9IG5ldyBVaW50OEFycmF5KG1ldGFkYXRhLmRhdGEpO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBNRVRBREFUQV9CWVRFUzsgKytpKSB7XG4gICAgICAgICAgICAgICAgZHN0W2xlbiArIGldID0gZGF0YVtpXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZW5jb2RlZEZyYW1lLmRhdGEgPSBkc3QuYnVmZmVyO1xuICAgICAgICAgICAgY29udHJvbGxlci5lbnF1ZXVlKGVuY29kZWRGcmFtZSk7XG4gICAgICAgIH0sXG4gICAgfSk7XG4gICAgcmVhZGFibGVTdHJlYW0ucGlwZVRocm91Z2godHJhbnNmb3JtU3RyZWFtKS5waXBlVG8od3JpdGFibGVTdHJlYW0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVjZWl2ZXJUcmFuc2Zvcm0ocmVhZGFibGVTdHJlYW0gOiBSZWFkYWJsZVN0cmVhbSwgd3JpdGFibGVTdHJlYW0gOiBXcml0YWJsZVN0cmVhbSwgdWlkIDogc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZU1ldGFkYXRhIDogRnVuY3Rpb24pIDogdm9pZCB7XG4gICAgY29uc3QgdHJhbnNmb3JtU3RyZWFtIDogVHJhbnNmb3JtU3RyZWFtV2l0aElEID0gbmV3IFRyYW5zZm9ybVN0cmVhbSh7XG4gICAgICAgIHN0YXJ0KCkgeyBjb25zb2xlLmxvZygnJWN3b3JrZXIgc2V0IHJlY2VpdmVyIHRyYW5zZm9ybSBmb3IgdWlkOicsICdjb2xvcjp5ZWxsb3cnLCB1aWQpOyB9LFxuICAgICAgICB0cmFuc2Zvcm0oZW5jb2RlZEZyYW1lLCBjb250cm9sbGVyKSB7XG5cbiAgICAgICAgICAgIGxldCBzcmMgPSBuZXcgVWludDhBcnJheShlbmNvZGVkRnJhbWUuZGF0YSk7XG4gICAgICAgICAgICBsZXQgbGVuID0gZW5jb2RlZEZyYW1lLmRhdGEuYnl0ZUxlbmd0aDtcblxuICAgICAgICAgICAgaWYgKGxlbiA8IE1FVEFEQVRBX0JZVEVTKSB7XG5cbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnJWNXQVJOSU5HOiByZWNlaXZlciB0cmFuc2Zvcm0gaGFzIG5vIG1ldGFkYXRhISB1aWQ6JywgJ2NvbG9yOnllbGxvdycsIHVpZCk7XG4gICAgICAgICAgICAgICAgY29udHJvbGxlci5lbnF1ZXVlKGVuY29kZWRGcmFtZSk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAvLyBjcmVhdGUgZHN0IGJ1ZmZlciB3aXRoIE1FVEFEQVRBX0JZVEVTIGZld2VyIGJ5dGVzXG4gICAgICAgICAgICAgICAgbGVuIC09IE1FVEFEQVRBX0JZVEVTO1xuICAgICAgICAgICAgICAgIGxldCBkc3QgPSBuZXcgVWludDhBcnJheShsZW4pO1xuXG4gICAgICAgICAgICAgICAgLy8gY29weSBzcmMgZGF0YVxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgICAgICAgICAgICAgZHN0W2ldID0gc3JjW2ldO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGV4dHJhY3QgbWV0YWRhdGEgYXQgdGhlIGVuZFxuICAgICAgICAgICAgICAgIGxldCBkYXRhID0gbmV3IFVpbnQ4QXJyYXkoTUVUQURBVEFfQllURVMpO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgTUVUQURBVEFfQllURVM7ICsraSkge1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2ldID0gc3JjW2xlbiArIGldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzb3VyY2VNZXRhZGF0YShkYXRhLmJ1ZmZlciwgdWlkKTtcblxuICAgICAgICAgICAgICAgIGVuY29kZWRGcmFtZS5kYXRhID0gZHN0LmJ1ZmZlcjtcbiAgICAgICAgICAgICAgICBjb250cm9sbGVyLmVucXVldWUoZW5jb2RlZEZyYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICB9KTtcbiAgICB0cmFuc2Zvcm1TdHJlYW0udWlkID0gdWlkO1xuICAgIHJlYWRhYmxlU3RyZWFtLnBpcGVUaHJvdWdoKHRyYW5zZm9ybVN0cmVhbSkucGlwZVRvKHdyaXRhYmxlU3RyZWFtKTtcbn1cbiIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0obW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4vLyBleHBvc2UgdGhlIG1vZHVsZXMgb2JqZWN0IChfX3dlYnBhY2tfbW9kdWxlc19fKVxuX193ZWJwYWNrX3JlcXVpcmVfXy5tID0gX193ZWJwYWNrX21vZHVsZXNfXztcblxuIiwiLy8gZGVmaW5lIGdldHRlciBmdW5jdGlvbnMgZm9yIGhhcm1vbnkgZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5kID0gKGV4cG9ydHMsIGRlZmluaXRpb24pID0+IHtcblx0Zm9yKHZhciBrZXkgaW4gZGVmaW5pdGlvbikge1xuXHRcdGlmKF9fd2VicGFja19yZXF1aXJlX18ubyhkZWZpbml0aW9uLCBrZXkpICYmICFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywga2V5KSkge1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIGtleSwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGRlZmluaXRpb25ba2V5XSB9KTtcblx0XHR9XG5cdH1cbn07IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5nID0gKGZ1bmN0aW9uKCkge1xuXHRpZiAodHlwZW9mIGdsb2JhbFRoaXMgPT09ICdvYmplY3QnKSByZXR1cm4gZ2xvYmFsVGhpcztcblx0dHJ5IHtcblx0XHRyZXR1cm4gdGhpcyB8fCBuZXcgRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdGlmICh0eXBlb2Ygd2luZG93ID09PSAnb2JqZWN0JykgcmV0dXJuIHdpbmRvdztcblx0fVxufSkoKTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwidmFyIHNjcmlwdFVybDtcbmlmIChfX3dlYnBhY2tfcmVxdWlyZV9fLmcuaW1wb3J0U2NyaXB0cykgc2NyaXB0VXJsID0gX193ZWJwYWNrX3JlcXVpcmVfXy5nLmxvY2F0aW9uICsgXCJcIjtcbnZhciBkb2N1bWVudCA9IF9fd2VicGFja19yZXF1aXJlX18uZy5kb2N1bWVudDtcbmlmICghc2NyaXB0VXJsICYmIGRvY3VtZW50KSB7XG5cdGlmIChkb2N1bWVudC5jdXJyZW50U2NyaXB0KVxuXHRcdHNjcmlwdFVybCA9IGRvY3VtZW50LmN1cnJlbnRTY3JpcHQuc3JjXG5cdGlmICghc2NyaXB0VXJsKSB7XG5cdFx0dmFyIHNjcmlwdHMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZShcInNjcmlwdFwiKTtcblx0XHRpZihzY3JpcHRzLmxlbmd0aCkgc2NyaXB0VXJsID0gc2NyaXB0c1tzY3JpcHRzLmxlbmd0aCAtIDFdLnNyY1xuXHR9XG59XG4vLyBXaGVuIHN1cHBvcnRpbmcgYnJvd3NlcnMgd2hlcmUgYW4gYXV0b21hdGljIHB1YmxpY1BhdGggaXMgbm90IHN1cHBvcnRlZCB5b3UgbXVzdCBzcGVjaWZ5IGFuIG91dHB1dC5wdWJsaWNQYXRoIG1hbnVhbGx5IHZpYSBjb25maWd1cmF0aW9uXG4vLyBvciBwYXNzIGFuIGVtcHR5IHN0cmluZyAoXCJcIikgYW5kIHNldCB0aGUgX193ZWJwYWNrX3B1YmxpY19wYXRoX18gdmFyaWFibGUgZnJvbSB5b3VyIGNvZGUgdG8gdXNlIHlvdXIgb3duIGxvZ2ljLlxuaWYgKCFzY3JpcHRVcmwpIHRocm93IG5ldyBFcnJvcihcIkF1dG9tYXRpYyBwdWJsaWNQYXRoIGlzIG5vdCBzdXBwb3J0ZWQgaW4gdGhpcyBicm93c2VyXCIpO1xuc2NyaXB0VXJsID0gc2NyaXB0VXJsLnJlcGxhY2UoLyMuKiQvLCBcIlwiKS5yZXBsYWNlKC9cXD8uKiQvLCBcIlwiKS5yZXBsYWNlKC9cXC9bXlxcL10rJC8sIFwiL1wiKTtcbl9fd2VicGFja19yZXF1aXJlX18ucCA9IHNjcmlwdFVybDsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLmIgPSBkb2N1bWVudC5iYXNlVVJJIHx8IHNlbGYubG9jYXRpb24uaHJlZjtcblxuLy8gb2JqZWN0IHRvIHN0b3JlIGxvYWRlZCBhbmQgbG9hZGluZyBjaHVua3Ncbi8vIHVuZGVmaW5lZCA9IGNodW5rIG5vdCBsb2FkZWQsIG51bGwgPSBjaHVuayBwcmVsb2FkZWQvcHJlZmV0Y2hlZFxuLy8gW3Jlc29sdmUsIHJlamVjdCwgUHJvbWlzZV0gPSBjaHVuayBsb2FkaW5nLCAwID0gY2h1bmsgbG9hZGVkXG52YXIgaW5zdGFsbGVkQ2h1bmtzID0ge1xuXHRcImJ1bmRsZVwiOiAwXG59O1xuXG4vLyBubyBjaHVuayBvbiBkZW1hbmQgbG9hZGluZ1xuXG4vLyBubyBwcmVmZXRjaGluZ1xuXG4vLyBubyBwcmVsb2FkZWRcblxuLy8gbm8gSE1SXG5cbi8vIG5vIEhNUiBtYW5pZmVzdFxuXG4vLyBubyBvbiBjaHVua3MgbG9hZGVkXG5cbi8vIG5vIGpzb25wIGZ1bmN0aW9uIiwiLyoqXG4gICAjIEhpZmlBdWRpb05vZGVzXG5cbiAgIGhpZmktYXVkaW8tbm9kZXMgcHJvdmlkZXMgc2V2ZXJhbCB7QGxpbmsgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1dlYl9BdWRpb19BUEkgfCBXZWIgQXVkaW99IGNvbXBhdGlibGUgbm9kZXMuXG5cbiAgICFbV2ViQXVkaW8gTm9kZXNdKC9zZG9jcy9IaWdoLUZpZGVsaXR5LUF1ZGlvLUVuZ2luZS5wbmcpXG5cbiAgIFN0YXJ0IGJ5IGNyZWF0aW5nIGFuIEF1ZGlvQ29udGV4dCB3aXRoIGEgc2FtcGxlUmF0ZSBvZiA0ODAwMC5cblxuICAgQ2FsbCB7QGxpbmsgc2V0dXBIUlRGfSB0byBsb2FkIG5lZWRlZCBXQVNNIG1vZHVsZXMuXG5cbiAgIE9uY2Uge0BsaW5rIHNldHVwSFJURn0gaXMgZG9uZSwge0BsaW5rIEhSVEZJbnB1dH1zIGNhbiBiZSBjcmVhdGVkLCBhcyBuZWVkZWQuICBFYWNoIHtAbGluayBIUlRGSW5wdXR9IHNob3VsZCBiZSBjb25uZWN0ZWRcbiAgIHRvIHRoZSBzaW5nbGV0b24ge0BsaW5rIEhSVEZPdXRwdXR9IG5vZGUuICBUaGUgcG9zaXRpb24gKHJlbGF0aXZlIHRvIHRoZSBMaXN0ZW5lcikgb2YgYW4ge0BsaW5rIEhSVEZJbnB1dH0gY2FuIGJlIHNldCB3aXRoXG4gICB7QGxpbmsgSFJURklucHV0LnNldFBvc2l0aW9ufS5cblxuICAgIyBNZXRhZGF0YVxuXG4gICBUaGlzIGxpYnJhcnkgbW9kaWZpZXMge0BsaW5rIFJUQ1BlZXJDb25uZWN0aW9ufXMgc28gdGhleSBhcmUgY3JlYXRlZCB3aXRoIHtAbGluayBlbmNvZGVkSW5zZXJ0YWJsZVN0cmVhbXN9IHNldCB0byBgdHJ1ZWAuXG4gICBJZiB7QGxpbmsgc2V0dXBIUlRGfSBpcyBjYWxsZWQgd2l0aCBhIG5vbi1udWxsIHtAbGluayBzZXRSZW1vdGVTb3VyY2VQb3NpdGlvblVwZGF0ZX0gcGFyYW1ldGVyLCBtZXRhZGF0YSBpcyBlbmFibGVkLiAgVGhlIDJEIHBvc2l0aW9uIG9mXG4gICBsb2NhbCBhdWRpby1zb3VyY2VzIHdpbGwgYmUgY29tYmluZWQgd2l0aCB0cmFuc21pdHRlZCBhdWRpby1kYXRhLCBhbmQgYXVkaW8tZGF0YSBmcm9tIHJlbW90ZSBzb3VyY2VzIHdpbGwgY29udGFpblxuICAgdGhlaXIgcmVzcGVjdGl2ZSBwb3NpdGlvbnMuXG5cbiAgIFRvIGNvbm5lY3QgdGhlIG1ldGFkYXRhIGVuY29kZXJzIGFuZCBkZWNvZGVycywgY2FsbCB7QGxpbmsgc2V0dXBTZW5kZXJNZXRhZGF0YX0gb24gYW55IHtAbGluayBSVENSdHBTZW5kZXJ9cyBjcmVhdGVkLFxuICAgYW5kIGNhbGwge0BsaW5rIHNldHVwUmVjZWl2ZXJNZXRhZGF0YX0gb24gYW55IHtAbGluayBSVENSdHBSZWNlaXZlcn1zLiBUbyB0cmFuc21pdCB0aGUgcG9zaXRpb24gb2YgdGhlIGxvY2FsIGxpc3RlbmVyLFxuICAgY2FsbCB7QGxpbmsgc2V0UG9zaXRpb259LiAgV2hlbiB0aGUgcG9zaXRpb24gb2YgYSByZW1vdGUgc291cmNlIGNoYW5nZXMsIHRoZSBmdW5jdGlvbiBnaXZlbiB0byB7QGxpbmsgc2V0dXBIUlRGfVxuICAgaXMgY2FsbGVkLWJhY2suXG5cbiAgIFVzZSBzaHV0ZG93bkhSVEYgdG8gY2xlYW4gdXAuXG5cbiAgIEBtb2R1bGUgSGlGaUF1ZGlvTm9kZXNcbiovXG5cbmltcG9ydCB7XG4gICAgQXVkaW9Db250ZXh0IGFzIFNBQ0F1ZGlvQ29udGV4dCxcbiAgICBJTWVkaWFTdHJlYW1BdWRpb0Rlc3RpbmF0aW9uTm9kZSxcbiAgICBBdWRpb1dvcmtsZXROb2RlIGFzIFNBQ0F1ZGlvV29ya2xldE5vZGVcbn0gZnJvbSBcInN0YW5kYXJkaXplZC1hdWRpby1jb250ZXh0XCI7XG5cbnR5cGUgQXVkaW9Xb3JrbGV0Tm9kZSA9IFNBQ0F1ZGlvV29ya2xldE5vZGU8U0FDQXVkaW9Db250ZXh0PjtcblxuXG4vLyBSVEMgd2l0aCBpbnNlcnRhYmxlIHN0cmVhbSBzdXBwb3J0XG4vKiogQGlnbm9yZSAqL1xuZXhwb3J0IGRlY2xhcmUgY2xhc3MgUlRDUnRwU2NyaXB0VHJhbnNmb3JtIHtcbiAgICBjb25zdHJ1Y3Rvcih3b3JrZXIgOiBXb3JrZXIsIG9wdGlvbnMgOiBhbnkpO1xufTtcbi8qKiBAaWdub3JlICovXG5leHBvcnQgaW50ZXJmYWNlIFJUQ1J0cFNlbmRlcklTIGV4dGVuZHMgUlRDUnRwU2VuZGVyIHtcbiAgICBjcmVhdGVFbmNvZGVkU3RyZWFtcz8gOiBGdW5jdGlvbixcbiAgICB0cmFuc2Zvcm0/IDogUlRDUnRwU2NyaXB0VHJhbnNmb3JtXG59XG4vKiogQGlnbm9yZSAqL1xuZXhwb3J0IGludGVyZmFjZSBSVENSdHBSZWNlaXZlcklTIGV4dGVuZHMgUlRDUnRwUmVjZWl2ZXIge1xuICAgIGNyZWF0ZUVuY29kZWRTdHJlYW1zPyA6IEZ1bmN0aW9uLFxuICAgIHRyYW5zZm9ybT8gOiBSVENSdHBTY3JpcHRUcmFuc2Zvcm1cbn1cblxuY29uc3QgaXNDaHJvbWUgPSAhIShuYXZpZ2F0b3IudXNlckFnZW50LmluZGV4T2YoXCJDaHJvbWVcIikgIT09IC0xKTtcbmNvbnN0IGlzU2ltZFN1cHBvcnRlZCA9ICgpID0+IHtcbiAgICBjb25zdCBzaW1kQmxvYiA9IFVpbnQ4QXJyYXkuZnJvbShbMCwgOTcsIDExNSwgMTA5LCAxLCAwLCAwLCAwLCAxLCA1LCAxLCA5NiwgMCwgMSwgMTIzLCAzLCAyLCAxLCAwLCAxMCwgMTAsIDEsIDgsIDAsIDY1LCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAyNTMsIDE1LCAyNTMsIDk4LCAxMV0pO1xuICAgIGNvbnN0IHNpbWRTdXBwb3J0ZWQgPSBXZWJBc3NlbWJseS52YWxpZGF0ZShzaW1kQmxvYik7XG4gICAgY29uc29sZS5sb2coJ1dlYkFzc2VtYmx5IFNJTUQgaXMgJyArIChzaW1kU3VwcG9ydGVkID8gJ3N1cHBvcnRlZCcgOiAnbm90IHN1cHBvcnRlZCcpICsgJyBieSB0aGlzIGJyb3dzZXIuJyk7XG4gICAgcmV0dXJuIHNpbWRTdXBwb3J0ZWQ7XG59O1xuY29uc3QgZW5jb2RlZFRyYW5zZm9ybVN1cHBvcnRlZCA9ICEhKHdpbmRvdyBhcyBhbnkpLlJUQ1J0cFNjcmlwdFRyYW5zZm9ybTtcbmNvbnNvbGUubG9nKCdXZWJSVEMgRW5jb2RlZCBUcmFuc2Zvcm0gaXMgJyArIChlbmNvZGVkVHJhbnNmb3JtU3VwcG9ydGVkID8gJ3N1cHBvcnRlZCcgOiAnbm90IHN1cHBvcnRlZCcpICsgJyBieSB0aGlzIGJyb3dzZXIuJyk7XG5cbmxldCBfUlRDUGVlckNvbm5lY3Rpb24gPSBSVENQZWVyQ29ubmVjdGlvbjtcbmZ1bmN0aW9uIHBhdGNoUlRDUGVlckNvbm5lY3Rpb24oX1JUQ1BlZXJDb25uZWN0aW9uIDogYW55KSB7XG4gICAgLy8gcGF0Y2ggUlRDUGVlckNvbm5lY3Rpb24gdG8gZW5hYmxlIGluc2VydGFibGUgc3RyZWFtc1xuICAgIChSVENQZWVyQ29ubmVjdGlvbiBhcyBhbnkpID0gZnVuY3Rpb24oLi4uY29uZmlnIDogYW55KSB7XG4gICAgICAgIGlmIChjb25maWcubGVuZ3RoKSBjb25maWdbMF0uZW5jb2RlZEluc2VydGFibGVTdHJlYW1zID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIG5ldyBfUlRDUGVlckNvbm5lY3Rpb24oLi4uY29uZmlnKTtcbiAgICB9XG59XG5wYXRjaFJUQ1BlZXJDb25uZWN0aW9uKF9SVENQZWVyQ29ubmVjdGlvbik7XG5sZXQgX1JUQ1BlZXJDb25uZWN0aW9uV2l0aE1ldGFkYXRhID0gUlRDUGVlckNvbm5lY3Rpb247XG5sZXQgX1JUQ1BlZXJDb25uZWN0aW9uV2l0aG91dE1ldGFkYXRhID0gX1JUQ1BlZXJDb25uZWN0aW9uO1xuXG4vKipcbiAgIE1ldGFEYXRhIGhvbGRzIGluZm9ybWF0aW9uIHdoaWNoIGNhbiBiZSBlbmNvZGVkIGFuZCBzZW50IGFsb25nIHdpdGggYXVkaW8gc3RyZWFtcy5cbiovXG5leHBvcnQgaW50ZXJmYWNlIE1ldGFEYXRhIHtcbiAgICAvKiogeCBwb3NpdGlvbiBpbiBtZXRlcnMgd2l0aGluIHRoZSB2aXJ0dWFsIGF1ZGlvIHNwYWNlLiAqL1xuICAgIHg/IDogbnVtYmVyLFxuICAgIC8qKiB5IHBvc2l0aW9uIGluIG1ldGVycyB3aXRoaW4gdGhlIHZpcnR1YWwgYXVkaW8gc3BhY2UuICovXG4gICAgeT8gOiBudW1iZXIsXG4gICAgLyoqIHogcG9zaXRpb24gaW4gbWV0ZXJzIHdpdGhpbiB0aGUgdmlydHVhbCBhdWRpbyBzcGFjZS4gKi9cbiAgICBvPyA6IG51bWJlclxufVxuXG5pbXBvcnQgeyBtZXRhZGF0YSwgc2VuZGVyVHJhbnNmb3JtLCByZWNlaXZlclRyYW5zZm9ybSB9IGZyb20gXCIuL3RyYW5zZm9ybS5qc1wiO1xuXG5sZXQgc2V0dXBIUlRGdERvbmUgOiBib29sZWFuID0gZmFsc2U7XG5sZXQgd29ya2VyIDogV29ya2VyID0gdW5kZWZpbmVkO1xubGV0IHJlbW90ZVNvdXJjZVBvc2l0aW9uVXBkYXRlIDogRnVuY3Rpb24gPSB1bmRlZmluZWQ7XG5cblxuZnVuY3Rpb24gc291cmNlTWV0YWRhdGFDYWxsYmFjayhidWZmZXIgOiBBcnJheUJ1ZmZlciwgdWlkIDogc3RyaW5nKSB7XG4gICAgaWYgKHJlbW90ZVNvdXJjZVBvc2l0aW9uVXBkYXRlKSB7XG4gICAgICAgIGxldCBkYXRhID0gbmV3IERhdGFWaWV3KGJ1ZmZlcik7XG5cbiAgICAgICAgbGV0IHggPSBkYXRhLmdldEludDE2KDApICogKDEvMjU2LjApO1xuICAgICAgICBsZXQgeSA9IGRhdGEuZ2V0SW50MTYoMikgKiAoMS8yNTYuMCk7XG4gICAgICAgIGxldCBvID0gZGF0YS5nZXRJbnQ4KDQpICogKE1hdGguUEkgLyAxMjguMCk7XG5cbiAgICAgICAgcmVtb3RlU291cmNlUG9zaXRpb25VcGRhdGUodWlkLCB4LCB5LCBvKTsgICAgICAgIFxuICAgIH1cbn1cblxuLyoqXG4gICBDYWxsIHtAbGluayBzZXR1cEhSVEZ9IHRvIGxvYWQgYW5kIGluaXRpYWxpemUgV0FTTSBtb2R1bGVzXG5cbiAgIEBleGFtcGxlXG4gICBgYGAgdHlwZXNjcmlwdFxuICAgZnVuY3Rpb24gcmVtb3RlU291cmNlTW92ZWQodWlkLCB4LCB5LCBvKSB7XG4gICAgICAgLy8gLi4uXG4gICB9XG5cbiAgIGF3YWl0IHNldHVwSFJURihhdWRpb0NvbnRleHQsIHJlbW90ZVNvdXJjZU1vdmVkKTtcbiAgIGxldCBsaXN0ZW5lciA9IG5ldyBIUlRGT3V0cHV0KGF1ZGlvQ29udGV4dCk7XG4gICBsZXQgbGltaXRlciA9IG5ldyBMaW1pdGVyKGF1ZGlvQ29udGV4dCk7XG4gICBsZXQgZHN0ID0gYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhU3RyZWFtRGVzdGluYXRpb24oKTtcbiAgIGxpc3RlbmVyLmNvbm5lY3QobGltaXRlcikuY29ubmVjdChkc3QpO1xuICAgbGV0IGF1ZGlvRWxlbWVudCA9IG5ldyBBdWRpbygpO1xuICAgYXVkaW9FbGVtZW50LnNyY09iamVjdCA9IGRzdC5zdHJlYW07XG4gICBhdWRpb0VsZW1lbnQucGxheSgpO1xuICAgYGBgXG5cbiAgIEBwYXJhbSB7QXVkaW9Db250ZXh0fSBhdWRpb0NvbnRleHQgLSBUaGUgQXVkaW9Db250ZXh0IHRvIHVzZS4gIEl0IHNob3VsZCBiZSBjcmVhdGVkIHdpdGggYSBzYW1wbGUtcmF0ZSBvZiA0ODAwMC5cbiAgIEBwYXJhbSB7RnVuY3Rpb259IHNldFJlbW90ZVNvdXJjZVBvc2l0aW9uVXBkYXRlIC0gQSBjYWxsYmFjayBmdW5jdGlvbiBmb3Igd2hlbiByZW1vdGUgU291cmNlcyBjaGFuZ2UgdGhlaXIgcG9zaXRpb24uICBUaGUgY2FsbGJhY2sgdGFrZXMgcGFyYW1ldGVycyBgKHVpZCA6IHN0cmluZywgeCA6IG51bWJlciwgeSA6IG51bWJlciwgbyA6IG51bWJlcilgLiAgVGhlIGB1aWRgIGlzIGZyb20gYSBwcmV2aW91cyBjYWxsIHRvIGBzZXR1cFJlY2VpdmVyTWV0YWRhdGFgLiAgYHhgIGFuZCBgeWAgYXJlIGluIG1ldGVycywgYG9gIGlzIGluIHJhZGlhbnMuXG4qL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldHVwSFJURihhdWRpb0NvbnRleHQgOiBBdWRpb0NvbnRleHQsIHNldFJlbW90ZVNvdXJjZVBvc2l0aW9uVXBkYXRlIDogRnVuY3Rpb24pIHtcblxuICAgIGlmIChzZXR1cEhSVEZ0RG9uZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiZG9uJ3QgY2FsbCBzZXR1cEhSVEYgdHdpY2Ugd2l0aG91dCBzaHV0ZG93bkhSVEYgaW4gYmV0d2Vlbi5cIik7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICByZW1vdGVTb3VyY2VQb3NpdGlvblVwZGF0ZSA9IHNldFJlbW90ZVNvdXJjZVBvc2l0aW9uVXBkYXRlO1xuXG4gICAgaWYgKGF1ZGlvQ29udGV4dC5zYW1wbGVSYXRlICE9IDQ4MDAwKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJzZXR1cEhSVEYgcmVxdWlyZXMgYW4gQXVkaW9Db250ZXh0IHNhbXBsZVJhdGUgb2YgNDgwMDAuXCIpO1xuICAgIH1cblxuICAgIGlmIChlbmNvZGVkVHJhbnNmb3JtU3VwcG9ydGVkKSB7XG4gICAgICAgIHdvcmtlciA9IG5ldyBXb3JrZXIoJy4vd29ya2VyLmpzJyk7XG4gICAgICAgIC8vIHdvcmtlciA9IG5ldyBXb3JrZXIobmV3IFVSTCgnLi93b3JrZXIuanMnLCBpbXBvcnQubWV0YS51cmwpKTtcbiAgICAgICAgd29ya2VyLm9ubWVzc2FnZSA9IGV2ZW50ID0+IHNvdXJjZU1ldGFkYXRhQ2FsbGJhY2soZXZlbnQuZGF0YS5tZXRhZGF0YSwgZXZlbnQuZGF0YS51aWQpO1xuICAgIH1cblxuICAgIGNvbnN0IHdhc21zaW1kVVJMID0gbmV3IFVSTCgnLi9oaWZpLndhc20uc2ltZC5qcycsIGltcG9ydC5tZXRhLnVybCk7XG4gICAgY29uc3Qgd2FzbVVSTCA9IG5ldyBVUkwoJy4vaGlmaS53YXNtLmpzJywgaW1wb3J0Lm1ldGEudXJsKTtcbiAgICBhd2FpdCBhdWRpb0NvbnRleHQuYXVkaW9Xb3JrbGV0LmFkZE1vZHVsZShpc1NpbWRTdXBwb3J0ZWQoKSA/IHdhc21zaW1kVVJMLnRvU3RyaW5nKCkgOiB3YXNtVVJMLnRvU3RyaW5nKCkpO1xuXG4gICAgLy8gdGVtcG9yYXJ5IGxpY2Vuc2UgdG9rZW4gdGhhdCBleHBpcmVzIDQvMS8yMDIzXG4gICAgY29uc3QgdG9rZW4gPSAnYUdsbWFRQUFBQUVZejM1amNOWW5aSTBMd2ZQMVlOa3M0M1VqQVZVYlhwT0swZ3VqRmRTdkVsSTFzTTRqekNBa0tYbmtabFA2NU1vb3BZZWhCZXduMmFaSTAxamE2ZWoxZWRyK01SbUZZd2M9JztcbiAgICBsZXQgaGlmaUxpY2Vuc2UgPSBuZXcgQXVkaW9Xb3JrbGV0Tm9kZShhdWRpb0NvbnRleHQsICd3YXNtLWxpY2Vuc2UnKTtcbiAgICBoaWZpTGljZW5zZS5wb3J0LnBvc3RNZXNzYWdlKHRva2VuKTtcblxuICAgIHNldHVwSFJURnREb25lID0gdHJ1ZTtcbn1cblxuXG4vKipcbiAgIEZyZWUgcmVzb3VyY2VzIGNvbnN1bWVkIGJ5IHtAbGluayBzZXR1cEhSVEZ9LlxuKi9cbmV4cG9ydCBmdW5jdGlvbiBzaHV0ZG93bkhSVEYoKSB7XG4gICAgaWYgKCFzZXR1cEhSVEZ0RG9uZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwic2h1dGRvd25IUlRGIGNhbGxlZCBiZWZvcmUgc2V0dXBIUlRGXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHdvcmtlciAmJiB3b3JrZXIudGVybWluYXRlKCk7XG4gICAgcmVtb3RlU291cmNlUG9zaXRpb25VcGRhdGUgPSB1bmRlZmluZWQ7XG4gICAgc2V0dXBIUlRGdERvbmUgPSBmYWxzZTtcbn1cblxuXG4vKipcbiAgIEEgTm9pc2VHYXRlIG5vZGUgaXMgaW50ZW5kZWQgdG8gc2l0IGJldHdlZW4gYSBtaWNyb3Bob25lIGFuZCBhIHNlbmRpbmcgV2ViUlRDIGNvbm5lY3Rpb24uICBJdCB3aWxsIHN1cHByZXNzIGF1ZGlvXG4gICBhdCBsZXZlbHMgYmVsb3cgdGhlIGFkanVzdGFibGUgdGhyZXNob2xkLiAgVXNlIG9mIGEgTm9pc2VHYXRlIG5vZGUgY2FuIGhlbHAgcmVtb3ZlIGJhY2tncm91bmQgbm9pc2UgYW5kXG4gICByZWR1Y2UgbmV0d29yayBiYW5kd2lkdGggdXNlZCB0byBzZW5kIGF1ZGlvLiAge0BsaW5rIHNldHVwSFJURn0gc2hvdWxkIGJlIGNhbGxlZCBiZWZvcmUgY3JlYXRpbmcgYSB7QGxpbmsgTm9pc2VHYXRlfSBub2RlLlxuXG4gICBAY2xhc3NcbiAgIEBleGFtcGxlXG4gICBgYGB0eXBlc2NyaXB0XG4gICBsZXQgbm9pc2VHYXRlID0gbmV3IE5vaXNlR2F0ZShhdWRpb0NvbnRleHQpO1xuICAgaWYgKG11dGVkKSB7XG4gICAgICAgbm9pc2VHYXRlLnNldFRocmVzaG9sZCgwKTtcbiAgIH0gZWxzZSB7XG4gICAgICAgbm9pc2VHYXRlLnNldFRocmVzaG9sZCgtNDApO1xuICAgfVxuICAgbGV0IHNvdXJjZU5vZGUgPSBhdWRpb0NvbnRleHQuY3JlYXRlTWVkaWFTdHJlYW1Tb3VyY2UobWVkaWFTdHJlYW0pO1xuICAgc291cmNlTm9kZS5jb25uZWN0KG5vaXNlR2F0ZSkuY29ubmVjdChkZXN0aW5hdGlvbk5vZGUpO1xuICAgYGBgXG4qL1xuZXhwb3J0IGNsYXNzIE5vaXNlR2F0ZSBleHRlbmRzIEF1ZGlvV29ya2xldE5vZGUge1xuICAgIC8qKlxuICAgICAgIEBwYXJhbSB7QXVkaW9Db250ZXh0fSBhdWRpb0NvbnRleHQgLSBUaGUgQXVkaW9Db250ZXh0IHRvIHVzZS4gIEl0IHNob3VsZCBiZSBjcmVhdGVkIHdpdGggYSBzYW1wbGUtcmF0ZSBvZiA0ODAwMC5cbiAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGF1ZGlvQ29udGV4dCA6IEF1ZGlvQ29udGV4dCkge1xuICAgICAgICBpZiAoIXNldHVwSFJURnREb25lKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiY2FsbCBzZXR1cEhSVEYgYmVmb3JlIGNyZWF0aW5nIE5vaXNlR2F0ZSBub2Rlcy5cIik7XG4gICAgICAgIH1cbiAgICAgICAgc3VwZXIoYXVkaW9Db250ZXh0LCAnd2FzbS1ub2lzZS1nYXRlJywgeyBjaGFubmVsQ291bnRNb2RlOiBcImV4cGxpY2l0XCIsIGNoYW5uZWxDb3VudDogMSB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgICBAcGFyYW0gdmFsdWUgLSBBIG5lZ2F0aXZlIHZhbHVlIGJldHdlZW4gLTgwIGFuZCAwIHdoaWNoIGluZGljYXRlcyBhIG1pbmltdW0gZGVjaWJsZSBsZXZlbCBmb3IgdGhlIG5vaXNlLWdhdGVcbiAgICAgICB0byBzdG9wIHN1cHByZXNzaW5nIGF1ZGlvLlxuICAgICAqL1xuICAgIHNldFRocmVzaG9sZCh2YWx1ZSA6IG51bWJlcikge1xuICAgICAgICB0aGlzLnBhcmFtZXRlcnMuZ2V0KCd0aHJlc2hvbGQnKS52YWx1ZSA9IHZhbHVlO1xuICAgIH1cbn1cblxuXG4vKipcbiAgIEhSVEZPdXRwdXQgcmVwcmVzZW50cyB0aGUgTGlzdGVuZXIuICBTb3VyY2VzICh7QGxpbmsgSFJURklucHV0fXMpIGFyZSBhcnJhbmdlZCBhcm91bmQgdGhpcyB0byBjcmVhdGUgc3BhdGlhbGl6ZWQgYXVkaW8uXG4gICBcblxuICAgQGV4YW1wbGVcbiAgIGBgYHR5cGVzY3JpcHRcbiAgIGxldCBsaXN0ZW5lciA9IG5ldyBIUlRGT3V0cHV0KGF1ZGlvQ29udGV4dCk7XG4gICBsZXQgbGltaXRlciA9IG5ldyBMaW1pdGVyKGF1ZGlvQ29udGV4dCk7XG4gICBsZXQgZGVzdGluYXRpb24gPSBhdWRpb0NvbnRleHQuY3JlYXRlTWVkaWFTdHJlYW1EZXN0aW5hdGlvbigpO1xuICAgbGlzdGVuZXIuY29ubmVjdChsaW1pdGVyKS5jb25uZWN0KGRlc3RpbmF0aW9uKTtcbiAgIGBgYFxuKi9cbmV4cG9ydCBjbGFzcyBIUlRGT3V0cHV0IGV4dGVuZHMgQXVkaW9Xb3JrbGV0Tm9kZSB7XG4gICAgLyoqXG4gICAgICAgQHBhcmFtIHtBdWRpb0NvbnRleHR9IGF1ZGlvQ29udGV4dCAtIFRoZSBBdWRpb0NvbnRleHQgdG8gdXNlLiAgSXQgc2hvdWxkIGJlIGNyZWF0ZWQgd2l0aCBhIHNhbXBsZS1yYXRlIG9mIDQ4MDAwLlxuICAgICovXG4gICAgY29uc3RydWN0b3IoYXVkaW9Db250ZXh0IDogQXVkaW9Db250ZXh0KSB7XG4gICAgICAgIGlmICghc2V0dXBIUlRGdERvbmUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJjYWxsIHNldHVwSFJURiBiZWZvcmUgY3JlYXRpbmcgYW4gSFJURk91dHB1dCBub2RlLlwiKTtcbiAgICAgICAgfVxuICAgICAgICBzdXBlcihhdWRpb0NvbnRleHQsICd3YXNtLWhydGYtb3V0cHV0Jywge291dHB1dENoYW5uZWxDb3VudCA6IFsyXX0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAgIENhbGwgc2V0UG9zaXRpb24gdG8gdXBkYXRlIHRoZSBsb2NhbCBMaXN0ZW5lcidzIHBvc2l0aW9uIHdpdGhpbiB0aGUgdmlydHVhbCBhdWRpbyBzcGFjZS5cbiAgICAgICBUaGUgcG9zaXRpb24gd2lsbCBiZSBzZW50IG92ZXIgdGhlIFdlYlJUQyBQZWVyQ29ubmVjdGlvbiBhbG9uZyB3aXRoIGF1ZGlvLWRhdGEuICBUaGlzIGZ1bmN0aW9uXG4gICAgICAgY2FuIG9ubHkgYmUgdXNlZCBpZiBzZXR1cEhSVEYgd2FzIGNhbGxlZCB3aXRoIGEgbm9uLW51bGwgTWV0YWRhdGFDYWxsYmFjayBmdW5jdGlvbi5cblxuICAgICAgIEBwYXJhbSB7TWV0YURhdGF9IHBvc2l0aW9uIC0gYW4gYXNzb2NpYXRpdmUgYXJyYXkgd2l0aCBtZW1iZXJzIGB4YCwgYHlgLCBhbmQgYG9gIHRvIGluZGljYXRlIHRoZSBwb3NpdGlvblxuICAgICAgIG9mIHRoZSBsb2NhbCBMaXN0ZW5lci4gIGB4YCBhbmQgYHlgIGFyZSBpbiBtZXRlcnMsIGFuZCBgb2AgaXMgaW4gcmFkaWFucy5cblxuICAgICAgIEBleGFtcGxlXG4gICAgICAgYGBgdHlwZXNjcmlwdFxuICAgICAgIGxldCBtZCA9IHt9O1xuICAgICAgIG1kLnggPSAxLjU7XG4gICAgICAgbWQueSA9IC0yO1xuICAgICAgIG1kLm8gPSAwLjc4NTtcbiAgICAgICBsaXN0ZW5lci5zZXRQb3NpdGlvbihtZCk7XG4gICAgICAgYGBgXG4gICAgKi9cbiAgICBzZXRQb3NpdGlvbihwb3NpdGlvbiA6IE1ldGFEYXRhKSB7XG4gICAgICAgIGlmICghc2V0dXBIUlRGdERvbmUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJjYWxsIHNldHVwSFJURiBiZWZvcmUgdXNpbmcgc2V0UG9zaXRpb25cIik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXJlbW90ZVNvdXJjZVBvc2l0aW9uVXBkYXRlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwic2V0UG9zaXRpb24gY2FuJ3QgYmUgdXNlZCB3aXRoIG51bGwgcmVtb3RlU291cmNlUG9zaXRpb25VcGRhdGVcIik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgZGF0YSA9IG5ldyBEYXRhVmlldyhuZXcgQXJyYXlCdWZmZXIoNSkpO1xuXG4gICAgICAgIGxldCBxeCA9IE1hdGgucm91bmQocG9zaXRpb24ueCAqIDI1Ni4wKTsgICAgLy8geCBpbiBRNy44XG4gICAgICAgIGxldCBxeSA9IE1hdGgucm91bmQocG9zaXRpb24ueSAqIDI1Ni4wKTsgICAgLy8geSBpbiBRNy44XG4gICAgICAgIGxldCBxbyA9IE1hdGgucm91bmQocG9zaXRpb24ubyAqICgxMjguMCAvIE1hdGguUEkpKTsgICAgLy8gYnJhZCBpbiBRN1xuXG4gICAgICAgIGRhdGEuc2V0SW50MTYoMCwgcXgpO1xuICAgICAgICBkYXRhLnNldEludDE2KDIsIHF5KTtcbiAgICAgICAgZGF0YS5zZXRJbnQ4KDQsIHFvKTtcblxuICAgICAgICBpZiAoZW5jb2RlZFRyYW5zZm9ybVN1cHBvcnRlZCkge1xuICAgICAgICAgICAgd29ya2VyLnBvc3RNZXNzYWdlKHtcbiAgICAgICAgICAgICAgICBvcGVyYXRpb246ICdtZXRhZGF0YScsXG4gICAgICAgICAgICAgICAgbWV0YWRhdGE6IGRhdGEuYnVmZmVyXG4gICAgICAgICAgICB9LCBbZGF0YS5idWZmZXJdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1ldGFkYXRhLmRhdGEgPSBkYXRhLmJ1ZmZlcjtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuXG4vKipcbiAgIExpbWl0ZXIgbm9kZSBpcyB1c2VkIHRvIGNvbnZlcnQgaGlnaCBkeW5hbWljIHJhbmdlIGF1ZGlvIGludG8gMTZiaXQgYXVkaW8gZm9yIHRyYW5zbWlzc2lvbiBvdmVyIGEgV2ViUlRDIGNvbm5lY3Rpb24uXG5cbiAgIEBleGFtcGxlXG4gICBgYGB0eXBlc2NyaXB0XG4gICBsZXQgbGlzdGVuZXIgPSBuZXcgSFJURk91dHB1dChhdWRpb0NvbnRleHQpO1xuICAgbGV0IGxpbWl0ZXIgPSBuZXcgTGltaXRlcihhdWRpb0NvbnRleHQpO1xuICAgbGV0IGRlc3RpbmF0aW9uID0gYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhU3RyZWFtRGVzdGluYXRpb24oKTtcbiAgIGxpc3RlbmVyLmNvbm5lY3QobGltaXRlcikuY29ubmVjdChkZXN0aW5hdGlvbik7XG4gICBgYGBcbiovXG5leHBvcnQgY2xhc3MgTGltaXRlciBleHRlbmRzIEF1ZGlvV29ya2xldE5vZGUge1xuICAgIC8qKlxuICAgICAgIEBwYXJhbSB7QXVkaW9Db250ZXh0fSBhdWRpb0NvbnRleHQgLSBUaGUgQXVkaW9Db250ZXh0IHRvIHVzZS4gIEl0IHNob3VsZCBiZSBjcmVhdGVkIHdpdGggYSBzYW1wbGUtcmF0ZSBvZiA0ODAwMC5cbiAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGF1ZGlvQ29udGV4dCA6IEF1ZGlvQ29udGV4dCkge1xuICAgICAgICBpZiAoIXNldHVwSFJURnREb25lKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiY2FsbCBzZXR1cEhSVEYgYmVmb3JlIGNyZWF0aW5nIGEgTGltaXRlciBub2RlLlwiKTtcbiAgICAgICAgfVxuICAgICAgICBzdXBlcihhdWRpb0NvbnRleHQsICd3YXNtLWxpbWl0ZXInLCB7b3V0cHV0Q2hhbm5lbENvdW50IDogWzJdfSk7XG4gICAgfVxufVxuXG5cblxuLyoqXG4gICBIUlRGSW5wdXQgcmVwcmVzZW50cyBhIHNwYXRpYWxpemVkIGF1ZGlvLXNvdXJjZSBiZWluZyBoZWFyZCBieSB0aGUgTGlzdGVuZXIgLyBIUlRGT3V0cHV0IG5vZGUuICBUaGUgYXVkaW8tc291cmNlIGNhblxuICAgYmUgYSBsb2NhbCBzb3VyY2UsIG9yIG9uZSByZWNpZXZlZCBvdmVyIFdlYlJUQy5cblxuICAgQGNsYXNzXG4gICBAZXhhbXBsZVxuICAgYGBgdHlwZXNjcmlwdFxuICAgIGxldCBzb3VyY2VOb2RlID0gbmV3IEF1ZGlvQnVmZmVyU291cmNlTm9kZShhdWRpb0NvbnRleHQpO1xuICAgIHNvdXJjZU5vZGUuYnVmZmVyID0gYXVkaW9CdWZmZXI7XG4gICAgc291cmNlTm9kZS5sb29wID0gdHJ1ZTtcbiAgICBsZXQgaHJ0ZklucHV0ID0gbmV3IEhSVEZJbnB1dChhdWRpb0NvbnRleHQpO1xuICAgIHNvdXJjZU5vZGUuY29ubmVjdChocnRmSW5wdXQpO1xuICAgIGBgYFxuICAgIGBgYHR5cGVzY3JpcHRcbiAgICBsZXQgbWVkaWFTdHJlYW1UcmFjayA9IGF1ZGlvVHJhY2suZ2V0TWVkaWFTdHJlYW1UcmFjaygpO1xuICAgIGxldCBtZWRpYVN0cmVhbSA9IG5ldyBNZWRpYVN0cmVhbShbbWVkaWFTdHJlYW1UcmFja10pO1xuICAgIGxldCBzb3VyY2VOb2RlID0gYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKG1lZGlhU3RyZWFtKTtcbiAgICBsZXQgaHJ0ZklucHV0ID0gbmV3IEhSVEZJbnB1dChhdWRpb0NvbnRleHQpO1xuICAgIHNvdXJjZU5vZGUuY29ubmVjdChocnRmSW5wdXQpO1xuICAgYGBgXG4qL1xuZXhwb3J0IGNsYXNzIEhSVEZJbnB1dCBleHRlbmRzIEF1ZGlvV29ya2xldE5vZGUge1xuICAgIC8qKlxuICAgICAgIEBwYXJhbSB7QXVkaW9Db250ZXh0fSBhdWRpb0NvbnRleHQgLSBUaGUgQXVkaW9Db250ZXh0IHRvIHVzZS4gIEl0IHNob3VsZCBiZSBjcmVhdGVkIHdpdGggYSBzYW1wbGUtcmF0ZSBvZiA0ODAwMC5cbiAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGF1ZGlvQ29udGV4dCA6IEF1ZGlvQ29udGV4dCkge1xuICAgICAgICBpZiAoIXNldHVwSFJURnREb25lKSBjb25zb2xlLmVycm9yKFwiY2FsbCBzZXR1cEhSVEYgYmVmb3JlIGNyZWF0aW5nIEhSVEZJbnB1dCBub2Rlcy5cIik7XG4gICAgICAgIHN1cGVyKGF1ZGlvQ29udGV4dCwgJ3dhc20taHJ0Zi1pbnB1dCcsIHsgY2hhbm5lbENvdW50TW9kZTogXCJleHBsaWNpdFwiLCBjaGFubmVsQ291bnQ6IDEgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICAgRGlzY29ubmVjdCB0aGlzIFdlYiBBdWRpbyBub2RlIGZyb20gb3RoZXIgbm9kZXMuXG4gICAgICovXG4gICAgZGlzY29ubmVjdCgpIHtcbiAgICAgICAgc3VwZXIuZGlzY29ubmVjdCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAgIFNldCB0aGUgcG9zaXRpb24gb2YgdGhpcyBhdWRpby1zb3VyY2UgcmVsYXRpdmUgdG8gdGhlIExpc3RlbmVyLlxuXG4gICAgICAgQHBhcmFtIGF6aW11dGggLSBhbmdsZSBpbiByYWRpYW5zIG1lYXN1cmVkIGJldHdlZW4gdGhlIGRpcmVjdGlvbiB0aGUgTGlzdGVuZXIgaXMgZmFjaW5nIGFuZCB0aGUgZGlyZWN0aW9uIHRvIHRoZSBTb3VyY2UuXG4gICAgICAgQHBhcmFtIGRpc3RhbmNlIC0gdGhlIFNvdXJjZSdzIGRpc3RhbmNlIGZyb20gdGhlIExpc3RlbmVyIGluIG1ldGVycy5cblxuICAgICAgICFbV2ViQXVkaW8gTm9kZXNdKC9zZG9jcy9BemltdXRoLWFuZC1EaXN0YW5jZS1EaWFncmFtLnBuZylcbiAgICAgKi9cbiAgICBzZXRQb3NpdGlvbihhemltdXRoIDogbnVtYmVyLCBkaXN0YW5jZSA6IG51bWJlcikge1xuICAgICAgICBpZiAoYXppbXV0aCA9PT0gYXppbXV0aCkge1xuICAgICAgICAgICAgKHRoaXMucGFyYW1ldGVycyBhcyB1bmtub3duIGFzIE1hcDxTdHJpbmcsIGFueT4pLmdldCgnYXppbXV0aCcpLnZhbHVlID0gYXppbXV0aDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGlzdGFuY2UgPT09IGRpc3RhbmNlKSB7XG4gICAgICAgICAgICAodGhpcy5wYXJhbWV0ZXJzIGFzIHVua25vd24gYXMgTWFwPFN0cmluZywgYW55PikuZ2V0KCdkaXN0YW5jZScpLnZhbHVlID0gZGlzdGFuY2U7XG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqXG4gICBXaGVuIG1ldGFkYXRhIGlzIGVuYWJsZWQsIGNhbGwge0BsaW5rIHNldHVwU2VuZGVyTWV0YWRhdGF9IHRvIGluc3RhbGwgYW4gZW5jb2RlcnMgaW4ge0BsaW5rIFJUQ1J0cFNlbmRlcn1zLiAgVGhpcyB3aWxsIGluc3RhbGxcbiAgIGVpdGhlciBhIFJUQ1J0cFNjcmlwdFRyYW5zZm9ybSAoU2FmYXJpKSBvciB1c2UgSW5zZXJ0YWJsZSBTdHJlYW1zIChDaHJvbWUpIHRvIGluamVjdCBwb3NpdGlvbiBpbmZvcm1hdGlvblxuICAgaW50byB0cmFuc21pdHRlZCBhdWRpby1kYXRhLlxuXG4gICBAZXhhbXBsZVxuICAgYGBgdHlwZXNjcmlwdFxuICAgbGV0IHNlbmRlcnMgPSBwZWVyQ29ubmVjdGlvbi5nZXRTZW5kZXJzKCk7XG4gICBsZXQgc2VuZGVyID0gc2VuZGVycy5maW5kKGUgPT4gZS50cmFjaz8ua2luZCA9PT0gJ2F1ZGlvJyk7XG4gICBzZXR1cFNlbmRlck1ldGFkYXRhKHNlbmRlcik7XG5cbiAgIGBgYFxuXG4gICBAcGFyYW0gc2VuZGVyIC0gYW4gUlRDUnRwU2VuZGVyIGluIHdoaWNoIHRvIGluc3RhbGwgYSBwb3NpdGlvbiBlbmNvZGVyLlxuKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXR1cFNlbmRlck1ldGFkYXRhKHNlbmRlciA6IFJUQ1J0cFNlbmRlcklTKSB7XG4gICAgaWYgKCFzZXR1cEhSVEZ0RG9uZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiY2FsbCBzZXR1cEhSVEYgYmVmb3JlIHVzaW5nIHNldHVwU2VuZGVyTWV0YWRhdGFcIik7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXJlbW90ZVNvdXJjZVBvc2l0aW9uVXBkYXRlKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJzZXR1cFNlbmRlck1ldGFkYXRhIGNhbid0IGJlIHVzZWQgd2l0aCBudWxsIHJlbW90ZVNvdXJjZVBvc2l0aW9uVXBkYXRlXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGVuY29kZWRUcmFuc2Zvcm1TdXBwb3J0ZWQpIHtcbiAgICAgICAgLy8gRW5jb2RlZCBUcmFuc2Zvcm1cbiAgICAgICAgc2VuZGVyLnRyYW5zZm9ybSA9IG5ldyBSVENSdHBTY3JpcHRUcmFuc2Zvcm0od29ya2VyLCB7IG9wZXJhdGlvbjogJ3NlbmRlcicgfSk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBJbnNlcnRhYmxlIFN0cmVhbXNcbiAgICAgICAgY29uc3Qgc2VuZGVyU3RyZWFtcyA9IHNlbmRlci5jcmVhdGVFbmNvZGVkU3RyZWFtcygpO1xuICAgICAgICBjb25zdCByZWFkYWJsZVN0cmVhbSA9IHNlbmRlclN0cmVhbXMucmVhZGFibGU7XG4gICAgICAgIGNvbnN0IHdyaXRhYmxlU3RyZWFtID0gc2VuZGVyU3RyZWFtcy53cml0YWJsZTtcbiAgICAgICAgc2VuZGVyVHJhbnNmb3JtKHJlYWRhYmxlU3RyZWFtLCB3cml0YWJsZVN0cmVhbSk7XG4gICAgfVxufVxuXG5cbi8qKlxuICAgV2hlbiBtZXRhZGF0YSBpcyBlbmFibGVkLCBjYWxsIHtAbGluayBzZXR1cFJlY2VpdmVyTWV0YWRhdGF9IHRvIGluc3RhbGwgZGVjb2RlcnMgaW4ge0BsaW5rIFJUQ1J0cFJlY2VpdmVyfXMuICBUaGlzIHdpbGwgaW5zdGFsbFxuICAgZWl0aGVyIGEgUlRDUnRwU2NyaXB0VHJhbnNmb3JtIChTYWZhcmkpIG9yIHVzZSBJbnNlcnRhYmxlIFN0cmVhbXMgKENocm9tZSkgdG8gZXh0cmFjdCBwb3NpdGlvbiBpbmZvcm1hdGlvblxuICAgZnJvbSB0cmFuc21pdHRlZCBhdWRpby1kYXRhLiAgV2hlbiBwb3NpdGlvbiBpbmZvcm1hdGlvbiBpcyBleHRyYWN0ZWQsIHRoZSB7QGxpbmsgUmVtb3RlU291cmNlUG9zaXRpb25VcGRhdGV9IGNhbGxiYWNrXG4gICBwYXNzZWQgdG8ge0BsaW5rIHNldHVwSFJURn0gd2lsbCBiZSBjYWxsZWQuXG5cbiAgIEBleGFtcGxlXG4gICBgYGB0eXBlc2NyaXB0XG4gICBsZXQgdHJhY2tJZCA9IC4uLjtcbiAgIGxldCByZWNlaXZlcnMgPSBwZWVyQ29ubmVjdGlvbi5nZXRSZWNlaXZlcnMoKTtcbiAgIGxldCByZWNlaXZlciA9IHJlY2VpdmVycy5maW5kKGUgPT4gZS50cmFjaz8uaWQgPT09IHRyYWNrSWQgJiYgZS50cmFjaz8ua2luZCA9PT0gJ2F1ZGlvJyk7XG4gICBzZXR1cFJlY2VpdmVyTWV0YWRhdGEocmVjZWl2ZXIsIHVpZCk7XG4gICBgYGBcblxuICAgQHBhcmFtIHJlY2VpdmVyIC0gYW4gUlRDUnRwUmVjZWl2ZXIgaW4gd2hpY2ggdG8gaW5zdGFsbCBhIHBvc2l0aW9uIGRlY29kZXIuXG4gICBAcGFyYW0gdWlkIC0gYSBzdHJpbmcgdXNlZCB0byBpZGVudGlmeSB0aGlzIHBhcnRpY3VsYXIgUlRDUnRwUmVjZWl2ZXIuICBXaGVuIHRoZSBgUmVtb3RlU291cmNlUG9zaXRpb25VcGRhdGVgIGNhbGxiYWNrIGlzIGNhbGxlZCwgdGhpcyBzdHJpbmcgd2lsbCBiZSBwYXNzZWQgYXMgdGhlIGZpcnN0IHBhcmFtZXRlci5cbiovXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBSZWNlaXZlck1ldGFkYXRhKHJlY2VpdmVyIDogUlRDUnRwUmVjZWl2ZXJJUywgdWlkIDogc3RyaW5nKSB7XG4gICAgaWYgKCFzZXR1cEhSVEZ0RG9uZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiY2FsbCBzZXR1cEhSVEYgYmVmb3JlIHVzaW5nIHNldHVwUmVjZWl2ZXJNZXRhZGF0YVwiKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghcmVtb3RlU291cmNlUG9zaXRpb25VcGRhdGUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcInNldHVwUmVjZWl2ZXJNZXRhZGF0YSBjYW4ndCBiZSB1c2VkIHdpdGggbnVsbCByZW1vdGVTb3VyY2VQb3NpdGlvblVwZGF0ZVwiKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChlbmNvZGVkVHJhbnNmb3JtU3VwcG9ydGVkKSB7XG4gICAgICAgIC8vIEVuY29kZWQgVHJhbnNmb3JtXG4gICAgICAgIHJlY2VpdmVyLnRyYW5zZm9ybSA9IG5ldyBSVENSdHBTY3JpcHRUcmFuc2Zvcm0od29ya2VyLCB7IG9wZXJhdGlvbjogJ3JlY2VpdmVyJywgdWlkIH0pO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gSW5zZXJ0YWJsZSBTdHJlYW1zXG4gICAgICAgIGNvbnN0IHJlY2VpdmVyU3RyZWFtcyA9IHJlY2VpdmVyLmNyZWF0ZUVuY29kZWRTdHJlYW1zKCk7XG4gICAgICAgIGNvbnN0IHJlYWRhYmxlU3RyZWFtID0gcmVjZWl2ZXJTdHJlYW1zLnJlYWRhYmxlO1xuICAgICAgICBjb25zdCB3cml0YWJsZVN0cmVhbSA9IHJlY2VpdmVyU3RyZWFtcy53cml0YWJsZTtcbiAgICAgICAgcmVjZWl2ZXJUcmFuc2Zvcm0ocmVhZGFibGVTdHJlYW0sIHdyaXRhYmxlU3RyZWFtLCB1aWQsIHNvdXJjZU1ldGFkYXRhQ2FsbGJhY2spO1xuICAgIH1cbn1cbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==