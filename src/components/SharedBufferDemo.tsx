import { useState, useEffect, useRef } from "react";
import useWorker from "../utils/useWorker";

// Define a worker URL outside component to avoid recreation
const workerUrl = new URL(
  "../workers/shared-buffer.worker.ts",
  import.meta.url
);

function SharedBufferDemo() {
  const [bufferSize, setBufferSize] = useState(100000);
  const [iterations, setIterations] = useState(100000);
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<number[]>([]);
  const intervalRef = useRef<number | null>(null);

  // Store references to shared buffer objects so they're accessible in the interval callback
  const sharedBufferRef = useRef<{
    buffer: SharedArrayBuffer | null;
    array: Float64Array | null;
    syncFlag: Int32Array | null;
  }>({
    buffer: null,
    array: null,
    syncFlag: null,
  });

  // Initialize the worker
  const { isReady, sendMessage } = useWorker(workerUrl, {
    onMessage: (data) => {
      if (data.type === "shared-complete") {
        console.log("Received shared-complete notification");

        // Read results from the shared buffer after receiving completion message
        if (sharedBufferRef.current.array) {
          const results = Array.from(sharedBufferRef.current.array).slice(
            0,
            10
          );
          console.log("Reading results from shared buffer:", results);
          setResult(results);
        } else {
          console.error("Cannot read results: shared array is null");
        }

        setIsCalculating(false);
        setProgress(100);

        // Stop the progress tracking interval
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else if (data.type === "progress" && data.progress !== undefined) {
        // Update progress based on worker's progress report
        console.log(`Received progress update: ${data.progress}%`);
        setProgress(data.progress);
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

    // Store references for later use
    sharedBufferRef.current = {
      buffer: sharedBuffer,
      array: sharedArray,
      syncFlag: syncFlag,
    };

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

    // Start an interval to check for completion via the atomic flag
    // We'll still use this as a backup in case messages are missed
    intervalRef.current = window.setInterval(() => {
      if (!sharedBufferRef.current.syncFlag) {
        console.error("Sync flag is null in interval");
        return;
      }

      // Check if calculation is complete
      const isDone = Atomics.load(sharedBufferRef.current.syncFlag, 0) === 1;

      if (isDone) {
        // Read results from the shared buffer
        if (sharedBufferRef.current.array) {
          const results = Array.from(sharedBufferRef.current.array).slice(
            0,
            10
          );
          console.log(
            "Reading results from shared buffer in interval:",
            results
          );
          setResult(results);
          setProgress(100);
          setIsCalculating(false);
        }

        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
      // We don't increment progress here anymore since we get it from the worker
    }, 200);

    // Send the shared buffer to the worker
    sendMessage({
      type: "compute-shared",
      buffer: sharedBuffer,
      bufferSize,
      iterations,
    });
  }

  // Styles for the number inputs and controls
  const inputContainerStyle = {
    display: "flex",
    alignItems: "center",
    marginBottom: "12px",
  };

  const labelStyle = {
    minWidth: "120px",
    fontWeight: 500,
    marginRight: "10px",
  };

  const inputStyle = {
    backgroundColor: "#1a1a1a",
    border: "1px solid #3f3f3f",
    borderRadius: "6px",
    padding: "8px 12px",
    color: "white",
    width: "120px",
    fontSize: "0.9rem",
    transition: "all 0.2s ease",
    outline: "none",
  };

  const inputDisabledStyle = {
    ...inputStyle,
    opacity: 0.6,
    cursor: "not-allowed",
  };

  const buttonStyle = {
    backgroundColor: "#646cff",
    color: "white",
    border: "none",
    borderRadius: "6px",
    padding: "10px 16px",
    fontWeight: 500,
    cursor: isReady && !isCalculating ? "pointer" : "not-allowed",
    opacity: isReady && !isCalculating ? 1 : 0.7,
    transition: "all 0.2s ease",
    marginTop: "20px",
    width: "100%",
    maxWidth: "300px",
  };

  return (
    <div className="shared-buffer-demo" style={{ padding: "20px" }}>
      <h2 style={{ marginBottom: "24px", fontSize: "1.8rem", fontWeight: 600 }}>
        SharedArrayBuffer Demo
      </h2>

      <div
        className="controls"
        style={{
          marginBottom: "30px",
          backgroundColor: "rgba(0,0,0,0.1)",
          padding: "20px",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        <div style={inputContainerStyle}>
          <label htmlFor="buffer-size" style={labelStyle}>
            Buffer Size:
          </label>
          <input
            id="buffer-size"
            type="number"
            min="10"
            max="100000"
            value={bufferSize}
            onChange={(e) => setBufferSize(Number(e.target.value))}
            disabled={isCalculating}
            style={isCalculating ? inputDisabledStyle : inputStyle}
            onMouseOver={(e) => {
              if (!isCalculating) {
                e.currentTarget.style.borderColor = "#646cff";
                e.currentTarget.style.boxShadow =
                  "0 0 0 2px rgba(100, 108, 255, 0.2)";
              }
            }}
            onMouseOut={(e) => {
              if (!isCalculating) {
                e.currentTarget.style.borderColor = "#3f3f3f";
                e.currentTarget.style.boxShadow = "none";
              }
            }}
          />
        </div>

        <div style={inputContainerStyle}>
          <label htmlFor="iterations" style={labelStyle}>
            Iterations:
          </label>
          <input
            id="iterations"
            type="number"
            min="1"
            max="10000"
            value={iterations}
            onChange={(e) => setIterations(Number(e.target.value))}
            disabled={isCalculating}
            style={isCalculating ? inputDisabledStyle : inputStyle}
            onMouseOver={(e) => {
              if (!isCalculating) {
                e.currentTarget.style.borderColor = "#646cff";
                e.currentTarget.style.boxShadow =
                  "0 0 0 2px rgba(100, 108, 255, 0.2)";
              }
            }}
            onMouseOut={(e) => {
              if (!isCalculating) {
                e.currentTarget.style.borderColor = "#3f3f3f";
                e.currentTarget.style.boxShadow = "none";
              }
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            onClick={startSharedCalculation}
            disabled={!isReady || isCalculating}
            style={buttonStyle}
            onMouseOver={(e) => {
              if (isReady && !isCalculating) {
                e.currentTarget.style.backgroundColor = "#535bf2";
              }
            }}
            onMouseOut={(e) => {
              if (isReady && !isCalculating) {
                e.currentTarget.style.backgroundColor = "#646cff";
              }
            }}
          >
            {isCalculating ? "Calculating..." : "Run Shared Buffer Calculation"}
          </button>
        </div>
      </div>

      {isCalculating && (
        <div
          className="progress-bar-container"
          style={{
            marginBottom: "20px",
            backgroundColor: "rgba(0,0,0,0.1)",
            borderRadius: "8px",
            padding: "15px",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)",
          }}
        >
          <div
            className="progress-bar"
            style={{
              width: `${progress}%`,
              height: "20px",
              backgroundColor: "#646cff",
              borderRadius: "4px",
              transition: "width 0.3s ease-in-out",
            }}
          />
          <div
            style={{ textAlign: "center", marginTop: "5px", fontWeight: 500 }}
          >
            {progress}%
          </div>
        </div>
      )}

      {result.length > 0 && (
        <div
          style={{
            marginTop: "20px",
            backgroundColor: "rgba(0,0,0,0.1)",
            borderRadius: "8px",
            padding: "20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <h3
            style={{
              marginBottom: "10px",
              fontSize: "1.2rem",
              fontWeight: 600,
            }}
          >
            Result from Shared Buffer (first 10 values):
          </h3>
          <pre
            style={{
              backgroundColor: "#1a1a1a",
              padding: "12px",
              borderRadius: "6px",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
          <p style={{ marginTop: "10px", fontSize: "0.9rem", opacity: 0.8 }}>
            Total size: {bufferSize} elements
          </p>
        </div>
      )}
    </div>
  );
}

export default SharedBufferDemo;
