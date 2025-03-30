// Define base message type
interface BaseWorkerMessage {
  type: string;
}

// Define specific message type for shared buffer operations
interface SharedBufferMessage extends BaseWorkerMessage {
  type: 'compute-shared';
  buffer: SharedArrayBuffer;
  bufferSize: number;
  iterations: number;
}

// Define progress message type
interface ProgressMessage {
  type: 'progress';
  progress: number;
}

// Helper function to check if a message is a SharedBufferMessage
function isSharedBufferMessage(message: BaseWorkerMessage): message is SharedBufferMessage {
  return (
    message.type === 'compute-shared' &&
    'buffer' in message &&
    message.buffer instanceof SharedArrayBuffer &&
    'bufferSize' in message &&
    typeof message.bufferSize === 'number' &&
    'iterations' in message &&
    typeof message.iterations === 'number'
  );
}

// Get worker context
const ctx = self as unknown as Worker;

// Listen for messages from the main thread
ctx.addEventListener('message', (event: MessageEvent<BaseWorkerMessage>) => {
  const { data } = event;
  console.log('Worker received message:', data);

  if (data.type === 'compute-shared') {
    // Use type guard to ensure the message has the correct structure
    if (isSharedBufferMessage(data)) {
      // Calculate the proper byte offset for the sync flag
      const floatArrayByteSize = data.bufferSize * Float64Array.BYTES_PER_ELEMENT;
      const syncFlagByteOffset = floatArrayByteSize;

      // Create typed arrays to work with the shared buffer
      // Specify the byte offset (0) and length explicitly to avoid alignment issues
      const sharedArray = new Float64Array(data.buffer, 0, data.bufferSize);
      const bufferSize = data.bufferSize;
      const iterations = data.iterations;

      console.log(`Worker starting computation with ${iterations} iterations`);

      // Create the sync flag at the proper offset
      const syncFlag = new Int32Array(data.buffer, syncFlagByteOffset, 1);

      // Perform the calculation
      performSharedCalculation(sharedArray, bufferSize, iterations, (progress) => {
        // Report progress back to the main thread
        ctx.postMessage({
          type: 'progress',
          progress
        } as ProgressMessage);
      });

      // Signal that computation is complete
      console.log('Setting completion flag');
      Atomics.store(syncFlag, 0, 1);

      // Notify the main thread that we're done
      console.log('Notifying main thread');
      Atomics.notify(syncFlag, 0, 1);

      // Also send a message to confirm completion
      ctx.postMessage({
        type: 'shared-complete'
      });
    } else {
      console.error('Invalid message format for compute-shared type');
    }
  }
});

// Function to perform calculations directly on the shared buffer
function performSharedCalculation(
  sharedArray: Float64Array,
  size: number,
  iterations: number,
  onProgress: (progress: number) => void
): void {
  // Simulate some heavy computation by filling the array with values
  for (let iter = 0; iter < iterations; iter++) {
    // Calculate and report progress as a percentage
    const progress = Math.floor((iter / iterations) * 100);

    // Only report progress every few iterations to avoid message spam
    if (iter % Math.max(1, Math.floor(iterations / 20)) === 0) {
      onProgress(progress);
    }

    for (let i = 0; i < size; i++) {
      // Compute a value and store it directly in the shared buffer
      sharedArray[i] = Math.sqrt(i * iter);
    }

    // Every 10 iterations (or every iteration if fewer than 10), report progress
    if (iter % Math.max(1, Math.floor(iterations / 10)) === 0) {
      console.log(`Worker progress: ${iter}/${iterations} iterations (${progress}%)`);
    }
  }

  // Report 100% progress when done
  onProgress(100);
  console.log('Worker completed calculation on shared buffer');
}

// Export empty object to satisfy TypeScript module requirements
export { } 