// Define the payload type
interface ComputePayload {
  value: number
}

// Define message types
interface WorkerMessage {
  type: string
  payload: ComputePayload
}

// Define result type
interface ComputeResult {
  originalData: ComputePayload
  computedValue: number
}

// Define response type
interface WorkerResponse {
  type: string
  result: ComputeResult
}

// Use the self reference for the worker context
const ctx = self as unknown as Worker

// Listen for messages from the main thread
ctx.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const { data } = event

  // Example computation
  if (data.type === 'compute') {
    // Perform some intensive calculation
    const result = performCalculation(data.payload)

    // Send the result back to the main thread
    const response: WorkerResponse = {
      type: 'result',
      result
    }

    ctx.postMessage(response)
  }
})

// Example computation function
function performCalculation(data: ComputePayload): ComputeResult {

  // Simulate some heavy computation
  let result = 0
  for (let i = 1; i < 1000000; i++) {
    result += Math.sqrt(i)
  }

  return {
    originalData: data,
    computedValue: result
  }
}

// Export empty object to satisfy TypeScript module requirements
export { } 