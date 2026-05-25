import * as webllm from '@mlc-ai/web-llm'

function setLabel(id: string, text: string) {
  const label = document.getElementById(id)
  if (label == null) {
    throw Error('Cannot find label ' + id)
  }
  label.innerText = text
}

async function mainStreaming() {
  const initProgressCallback = (report: webllm.InitProgressReport) => {
    console.log('Init progress', report)
    // setLabel('init-label', report.text)
  }
  const selectedModel = 'Llama-3.1-8B-Instruct-q4f32_1-MLC'

  const engine = await webllm.CreateWebWorkerMLCEngine(
    new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    }),
    selectedModel,
    { initProgressCallback }, // engineConfig
  )

  const request: webllm.ChatCompletionRequest = {
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful, respectful and honest assistant. ' + 'Be as happy as you can when speaking please. ',
      },
      { role: 'user', content: 'Provide me three US states.' },
      { role: 'assistant', content: 'California, New York, Pennsylvania.' },
      { role: 'user', content: 'Two more please!' },
    ],
    temperature: 1.5,
    max_tokens: 256,
  }

  const asyncChunkGenerator = await engine.chat.completions.create(request)
  let message = ''
  for await (const chunk of asyncChunkGenerator) {
    console.log(chunk)
    message += chunk.choices[0]?.delta?.content || ''
    setLabel('generate-label', message)
    if (chunk.usage) {
      console.log(chunk.usage) // only last chunk has usage
    }
    // engine.interruptGenerate();  // works with interrupt as well
  }
  console.log('Final message:\n', await engine.getMessage()) // the concatenated message
}

//   registerServiceWorker()
//   // Run one of the function below
//   // mainNonStreaming();
mainStreaming()
