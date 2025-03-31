# SharedArrayBuffer with Web Workers

This project demonstrates how to use SharedArrayBuffer to efficiently share memory between the main thread and web workers.

## What is SharedArrayBuffer?

SharedArrayBuffer provides a way to create a fixed-length binary data buffer that can be simultaneously accessed by the main thread and Web Workers. Unlike regular messaging with `postMessage()`, which creates copies of the data, SharedArrayBuffer allows direct access to the same memory region.

## Security Requirements

Due to the Spectre and Meltdown vulnerabilities, browsers require specific HTTP headers to use SharedArrayBuffer:

```javascript
// In vite.config.ts
server: {
  headers: {
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin'
  }
}
```

## How SharedArrayBuffer Works in this Project

### 1. Creating the Shared Memory

```javascript
// Main thread
const bufferSize = 1000;
const floatArrayByteSize = bufferSize * Float64Array.BYTES_PER_ELEMENT;
const syncFlagByteOffset = floatArrayByteSize;
const totalByteSize = floatArrayByteSize + Int32Array.BYTES_PER_ELEMENT;

// Create the shared buffer with enough space for data + synchronization
const sharedBuffer = new SharedArrayBuffer(totalByteSize);

// Create a typed array view on the shared buffer for the data
const sharedArray = new Float64Array(sharedBuffer, 0, bufferSize);

// Create a typed array view for synchronization (at the end of the buffer)
const syncFlag = new Int32Array(sharedBuffer, syncFlagByteOffset, 1);
Atomics.store(syncFlag, 0, 0); // Initialize sync flag to 0 (not done)
```

### 2. Sending the Buffer to the Worker

```javascript
// Send only a reference to the SharedArrayBuffer (no copying)
worker.postMessage({
  type: "compute-shared",
  buffer: sharedBuffer,  // This is transferred, not copied
  bufferSize,
  iterations, // some other data we want to send
});
```

### 3. Accessing the Shared Memory from the Worker

```javascript
// Worker thread
const sharedArray = new Float64Array(data.buffer, 0, data.bufferSize);
const syncFlag = new Int32Array(data.buffer, syncFlagByteOffset, 1);

// Directly modify the shared memory
for (let i = 0; i < size; i++) {
  sharedArray[i] = Math.sqrt(i * iter);
}

// When done, update the sync flag
Atomics.store(syncFlag, 0, 1);  // Set to 1 (done)
Atomics.notify(syncFlag, 0, 1); // Wake waiting threads
```

### 4. Synchronization with Atomics API

The Atomics API provides thread-safe operations on shared memory:

```javascript
// Main thread waiting for completion
const isDone = Atomics.load(syncFlag, 0) === 1;
if (isDone) {
  // Read results from the shared memory
  const results = Array.from(sharedArray).slice(0, 10);
}

// Worker thread signaling completion
Atomics.store(syncFlag, 0, 1);    // Thread-safe write
Atomics.notify(syncFlag, 0, 1);   // Wake up waiting threads
```

## Key Benefits of SharedArrayBuffer

1. **Performance**: No serialization/deserialization or copying of data
2. **Memory Efficiency**: Single memory allocation shared between threads
3. **Real-time Updates**: Main thread can directly observe changes as the worker makes them
4. **Atomic Operations**: Thread-safe operations via the Atomics API

## Common Pitfalls and Solutions

1. **Memory Alignment**: Ensure proper alignment when creating typed array views
   ```javascript
   // Correct:
   const sharedArray = new Float64Array(buffer, 0, size);
   // Float64Array needs 8-byte alignment
   ```

2. **Security Headers**: SharedArrayBuffer requires specific HTTP headers
   - Cross-Origin-Embedder-Policy: require-corp
   - Cross-Origin-Opener-Policy: same-origin

3. **Synchronization**: Always use Atomics API for coordination between threads
   ```javascript
   // Never use normal assignments for synchronization flags
   syncFlag[0] = 1;  // WRONG - not thread safe
   
   // Instead use:
   Atomics.store(syncFlag, 0, 1);  // RIGHT - thread safe
   ```

4. **Type Safety**: When passing SharedArrayBuffer between threads, ensure proper type information
   ```javascript
   // Include enough metadata so the receiving thread can correctly interpret the buffer
   worker.postMessage({
     buffer: sharedBuffer,
     bufferSize,
     dataType: 'Float64Array'
   });
   ```

## Browser Support

SharedArrayBuffer is supported in all modern browsers, but requires the proper security headers. See [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#browser_compatibility) for more detailed compatibility information.
