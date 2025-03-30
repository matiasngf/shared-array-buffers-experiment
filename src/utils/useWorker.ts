import { useEffect, useRef, useState } from 'react'

// We're using a generic type parameter to allow flexibility in the response data structure
interface WorkerResponse<T = unknown> {
  type: string
  result: T
}

interface WorkerMessage<P = unknown> {
  type: string
  payload: P
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
        if (optionsRef.current?.onMessage) {
          optionsRef.current.onMessage(event.data as WorkerResponse<T>)
        }
      }

      worker.addEventListener('message', messageHandler)

      setIsReady(true)

      // Clean up worker on unmount
      return () => {
        worker.removeEventListener('message', messageHandler)
        worker.terminate()
        workerRef.current = null
      }
    } catch (error) {
      console.error("Error initializing worker:", error)
    }
  }, [workerPath])

  // Function to send messages to the worker
  const sendMessage = <P = unknown>(message: WorkerMessage<P>) => {
    if (workerRef.current) {
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