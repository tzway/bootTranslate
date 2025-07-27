## bootTranslate
This userscript translates course content on Boot.dev by intercepting API requests and replacing the responses with translated versions. It also features persistent cache of translated content, in order to save your api tokens and reduce response time. Enjoy Boot.dev in your preferred language!

## Demo

https://github.com/user-attachments/assets/a8a53469-2cb1-4420-938f-d5f9f96585d2

![](./demo_assets/screenshot1.png)

![](./demo_assets/screenshot2.png)

## How to Install?



## How to try the script without an LLM api?

https://github.com/user-attachments/assets/3af5d9fc-db21-4f87-880c-6c4ead277a7f

## Configuration

Set up the config object prior to usage.

```javascript
const config = {
    targetLanguage: "YourLanguage",
    llmUrl: "https://your-llm-api-provider/v1/chat/completions",
    llmModel: "model-name",
    llmKey: "your-api-key-here"
}
```
