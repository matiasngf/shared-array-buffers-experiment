import { useEffect, useRef, useState } from 'react'

// We're using a generic type parameter to allow flexibility in the response data structure
interface WorkerResponse<T = unknown> {
  type: string
  result?: T
}

interface WorkerMessage<P = unknown> {
  type: string
  payload?: P
}

// Specific message type for SharedArrayBuffer operations
interface SharedBufferMessage extends WorkerMessage {
  type: 'compute-shared'
  buffer: SharedArrayBuffer
  bufferSize: number
  iterations: number
}

interface UseWorkerOptions<T = unknown> {
  onMessage?: (data: WorkerResponse<T>) => void
}

function useWorker<T = unknown>(workerPath: URL, options?: UseWorkerOptions<T>) {
  const [isReady, setIsReady] = useState(false)
  const workerRef = useRef<Worker | null>(null)

  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    // Create worker
    try {
      const worker = new Worker(workerPath, { type: 'module' })
      workerRef.current = worker

      // Set up message handler
      const messageHandler = (event: MessageEvent) => {
        console.log("Main thread received message:", event.data)
        if (optionsRef.current?.onMessage) {
          optionsRef.current.onMessage(event.data as WorkerResponse<T>)
        }
      }

      worker.addEventListener('message', messageHandler)
      console.log("Worker initialized and listener attached")

      setIsReady(true)

      // Clean up worker on unmount
      return () => {
        console.log("Terminating worker")
        worker.removeEventListener('message', messageHandler)
        worker.terminate()
        workerRef.current = null
      }
    } catch (error) {
      console.error("Error initializing worker:", error)
    }
  }, [workerPath])

  // Function to send messages to the worker
  function sendMessage<P = unknown>(message: WorkerMessage<P> | SharedBufferMessage) {
    if (workerRef.current) {
      console.log("Sending message to worker:", message)
      workerRef.current.postMessage(message)
    } else {
      console.error('Worker not initialized')
    }
  }

  return {
    isReady,
    sendMessage,
    worker: workerRef.current
  }
}

export default useWorker 