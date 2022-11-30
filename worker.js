//
//  Created by Ken Cooke on 3/11/22.
//  Copyright 2022 High Fidelity, Inc.
//
//  The contents of this file are PROPRIETARY AND CONFIDENTIAL, and may not be
//  used, disclosed to third parties, copied or duplicated in any form, in whole
//  or in part, without the prior written consent of High Fidelity, Inc.
//

'use strict';

self.importScripts('worker-transform.js');

function sourceMetadata(buffer, uid) {
    self.postMessage({
        operation: 'metadata',
        uid,
        metadata: buffer,
    }, [buffer]);
}

self.onmessage = function (event) {
    switch (event.data.operation) {
        case 'metadata':
            metadata = event.data.metadata;
            break;
        case 'sender':
            // when using Insertable Streams
            //senderTransform(event.data.readableStream, event.data.writableStream);
            break;
        case 'receiver':
            // when using Insertable Streams
            //receiverTransform(event.data.readableStream, event.data.writableStream, event.data.uid);
            break;
    }
}

self.onrtctransform = function (event) {
    const transformer = event.transformer;
    switch (transformer.options.operation) {
        case 'sender':
            // when using Encoded Transform
            senderTransform(transformer.readable, transformer.writable);
            break;
        case 'receiver':
            // when using Encoded Transform
            receiverTransform(transformer.readable, transformer.writable, transformer.options.uid);
            break;
    }
}
