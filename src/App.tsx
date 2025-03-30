import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import useWorker from "./utils/useWorker";

// Define the result type to avoid using any
interface ComputeResult {
  originalData: {
    value: number;
  };
  computedValue: number;
}

// Define payload type
interface ComputePayload {
  value: number;
}

const workerUrl = new URL("./workers/computation.worker.ts", import.meta.url);

function App() {
  const [count, setCount] = useState(0);
  const [result, setResult] = useState<ComputeResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Create a URL for the worker

  // Initialize the worker with the correct type
  const { isReady, sendMessage } = useWorker<ComputeResult>(workerUrl, {
    onMessage: (data) => {
      if (data.type === "result") {
        setResult(data.result);
        setIsCalculating(false);
      }
    },
  });

  // Start a calculation
  function startCalculation() {
    setIsCalculating(true);
    setResult(null);
    sendMessage<ComputePayload>({
      type: "compute",
      payload: { value: count },
    });
  }

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React + Web Workers</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>

        <div style={{ marginTop: "20px" }}>
          <button
            onClick={startCalculation}
            disabled={!isReady || isCalculating}
          >
            {isCalculating
              ? "Calculating..."
              : "Run Heavy Calculation in Worker"}
          </button>
        </div>

        {result && (
          <div style={{ marginTop: "20px" }}>
            <h3>Result from Worker:</h3>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}

        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
