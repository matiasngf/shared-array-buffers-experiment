import { useState, useEffect, useRef } from "react";
import useWorker from "../utils/useWorker";

const workerUrl = new URL(
  "../workers/shared-buffer.worker.ts",
  import.meta.url
);

function SharedBufferDemo() {
  const [bufferSize, setBufferSize] = useState(1000);
  const [iterations, setIterations] = useState(100);
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<number[]>([]);
  const intervalRef = useRef<number | null>(null);

  // Initialize the worker
  const { isReady, sendMessage } = useWorker(workerUrl, {
    onMessage: (data) => {
      if (data.type === "shared-complete") {
        console.log("Received shared-complete notification");
        setIsCalculating(false);

        // Stop the progress tracking interval
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        setProgress(100);
      }
    },
  });

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  function startSharedCalculation() {
    // Calculate sizes with proper alignment
    const floatArrayByteSize = bufferSize * Float64Array.BYTES_PER_ELEMENT;

    // Ensure alignment for Int32Array by padding if necessary
    // Float64Array needs 8-byte alignment
    // Int32Array needs 4-byte alignment
    // Since Float64Array already ensures 8-byte alignment, we're good
    const syncFlagByteOffset = floatArrayByteSize;

    // Total buffer size needs to include the Float64Array and Int32Array
    const totalByteSize = floatArrayByteSize + Int32Array.BYTES_PER_ELEMENT;

    console.log(`Creating SharedArrayBuffer with size ${totalByteSize} bytes`);
    console.log(
      `Float64Array: ${floatArrayByteSize} bytes, Int32Array at offset ${syncFlagByteOffset}`
    );

    // Create the shared buffer
    const sharedBuffer = new SharedArrayBuffer(totalByteSize);

    // Initialize the buffer with zeros
    const sharedArray = new Float64Array(sharedBuffer, 0, bufferSize);
    for (let i = 0; i < bufferSize; i++) {
      sharedArray[i] = 0;
    }

    // Initialize the sync flag (0 = not done, 1 = done)
    const syncFlag = new Int32Array(sharedBuffer, syncFlagByteOffset, 1);
    Atomics.store(syncFlag, 0, 0);

    console.log(
      "Starting shared buffer calculation with",
      bufferSize,
      "elements and",
      iterations,
      "iterations"
    );
    setIsCalculating(true);
    setProgress(0);
    setResult([]);

    // Start an interval to check progress
    intervalRef.current = window.setInterval(() => {
      // Check if calculation is complete
      const isDone = Atomics.load(syncFlag, 0) === 1;

      if (isDone) {
        // Read results from the shared buffer
        const results = Array.from(sharedArray).slice(0, 10); // Just show first 10 values
        setResult(results);
        setProgress(100);
        setIsCalculating(false);

        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        // Increment progress for visual feedback (approximation)
        setProgress((prev) => Math.min(prev + 5, 95));
      }
    }, 200);

    // Send the shared buffer to the worker
    sendMessage({
      type: "compute-shared",
      buffer: sharedBuffer,
      bufferSize,
      iterations,
    });
  }

  return (
    <div className="shared-buffer-demo">
      <h2>SharedArrayBuffer Demo</h2>

      <div className="controls" style={{ marginBottom: "20px" }}>
        <div>
          <label htmlFor="buffer-size">Buffer Size: </label>
          <input
            id="buffer-size"
            type="number"
            min="10"
            max="100000"
            value={bufferSize}
            onChange={(e) => setBufferSize(Number(e.target.value))}
            disabled={isCalculating}
          />
        </div>

        <div style={{ marginTop: "10px" }}>
          <label htmlFor="iterations">Iterations: </label>
          <input
            id="iterations"
            type="number"
            min="1"
            max="10000"
            value={iterations}
            onChange={(e) => setIterations(Number(e.target.value))}
            disabled={isCalculating}
          />
        </div>

        <button
          onClick={startSharedCalculation}
          disabled={!isReady || isCalculating}
          style={{ marginTop: "10px" }}
        >
          {isCalculating
            ? "Calculating..."
            : "Run Calculation with SharedArrayBuffer"}
        </button>
      </div>

      {isCalculating && (
        <div
          className="progress-bar-container"
          style={{ marginBottom: "20px" }}
        >
          <div
            className="progress-bar"
            style={{
              width: `${progress}%`,
              height: "20px",
              backgroundColor: "#646cff",
              transition: "width 0.3s ease-in-out",
            }}
          />
          <div style={{ textAlign: "center" }}>{progress}%</div>
        </div>
      )}

      {result.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h3>Result from Shared Buffer (first 10 values):</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
          <p>Total size: {bufferSize} elements</p>
        </div>
      )}
    </div>
  );
}

export default SharedBufferDemo;
