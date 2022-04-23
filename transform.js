//
//  Created by Ken Cooke on 3/11/22.
//  Copyright 2022 High Fidelity, Inc.
//
//  The contents of this file are PROPRIETARY AND CONFIDENTIAL, and may not be
//  used, disclosed to third parties, copied or duplicated in any form, in whole
//  or in part, without the prior written consent of High Fidelity, Inc.
//

'use strict';

const METADATA_BYTES = 5;
let metadata = new Uint8Array(METADATA_BYTES);

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
            let data = new Uint8Array(metadata);
            for (let i = 0; i < METADATA_BYTES; ++i) {
                dst[len + i] = data[i];
            }

            encodedFrame.data = dst.buffer;
            controller.enqueue(encodedFrame);
        },
    });
    readableStream.pipeThrough(transformStream).pipeTo(writableStream);
}

function receiverTransform(readableStream, writableStream, uid) {
    const transformStream = new TransformStream({
        uid,
        start() { console.log('%cworker set receiver transform for uid:', 'color:yellow', uid); },
        transform(encodedFrame, controller) {

            let src = new Uint8Array(encodedFrame.data);
            let len = encodedFrame.data.byteLength - METADATA_BYTES;

            // create dst buffer with METADATA_BYTES fewer bytes
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
        },
    });
    readableStream.pipeThrough(transformStream).pipeTo(writableStream);
}
