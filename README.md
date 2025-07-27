## bootTranslate
This userscript translates course content on Boot.dev by intercepting API requests and replacing the responses with translated versions. It also features persistent cache of translated content, in order to save your api tokens and reduce response time. Enjoy Boot.dev in your preferred language!

## Demo

https://private-user-images.githubusercontent.com/25824673/471160312-a8a53469-2cb1-4420-938f-d5f9f96585d2.mp4?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NTM1NzgzODIsIm5iZiI6MTc1MzU3ODA4MiwicGF0aCI6Ii8yNTgyNDY3My80NzExNjAzMTItYThhNTM0NjktMmNiMS00NDIwLTkzOGYtZDVmOWY5NjU4NWQyLm1wND9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTA3MjclMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjUwNzI3VDAxMDEyMlomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTc5NjgyNjM5MjUzN2QxODMwODJlMjg3MTk4NWRkNzhjOTFhNTQ2MjEwMWMzNWMwNzJiOTNiMDAzMzZjNWZmNDAmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.JHR4dLfPCkqRPbTxWrBnIa0Zv4cyIS3gShpYKqimF_M

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
