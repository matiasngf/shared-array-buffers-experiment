/// <reference types="vite/client" />

// Declare worker module
declare module '*?worker' {
  const workerConstructor: {
    new(): Worker
  }
  export default workerConstructor
}

// Declare direct worker import
declare module '*/workers/*.worker.ts' {
  const workerPath: URL
  export default workerPath
} 