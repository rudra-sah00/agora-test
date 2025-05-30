# Agora Voice Call Demo

A simple HTML and JavaScript application that connects to Agora's voice calling service for audio-only communication.

## Features

- Join/leave voice channels using Agora SDK
- Real-time audio communication
- Mute/unmute functionality
- Simple and clean user interface
- Input validation and error handling
- Support for tokens and custom UIDs

## Setup

1. **Get Agora Credentials:**
   - Sign up at [Agora Console](https://console.agora.io/)
   - Create a new project
   - Get your App ID from the project dashboard
   - (Optional) Generate a temporary token for testing

2. **Run the Application:**
   - Open `index.html` in a web browser
   - Or serve it using a local web server:
     ```bash
     # Using Python
     python -m http.server 8000
     
     # Using Node.js (if you have live-server installed)
     npx live-server
     
     # Using PHP
     php -S localhost:8000
     ```

## Usage

1. **Fill in the form:**
   - **App ID**: Your Agora App ID (required)
   - **Token**: Leave empty for testing, or use a generated token for production
   - **Channel Name**: Name/identifier for the channel you want to join
   - **UID**: Leave empty for auto-generation, or specify a number

2. **Join Channel:**
   - Click "Join Channel" to connect
   - Allow microphone permissions when prompted by the browser
   - Your audio status will be shown in the audio container
   - You can see how many remote users are connected

3. **Voice Controls:**
   - Use the "Mute/Unmute" button to control your microphone
   - The button will turn red when muted

4. **Leave Channel:**
   - Click "Leave Channel" to disconnect

## File Structure

```
├── index.html          # Main HTML file with UI for voice calls
├── agora-client.js     # JavaScript logic for Agora voice integration
└── README.md           # This file
```

## Browser Compatibility

- Chrome 58+
- Firefox 56+
- Safari 11+
- Edge 79+

## Security Notes

- For production use, implement proper token generation on your server
- Never expose your App Certificate in client-side code
- Consider implementing user authentication

## Troubleshooting

1. **Microphone Access Denied:**
   - Check browser permissions
   - Ensure you're accessing via HTTPS or localhost

2. **Connection Failed:**
   - Verify App ID is correct
   - Check network connectivity
   - Ensure token is valid (if using one)

3. **No Remote Audio:**
   - Ensure other users have joined the same channel
   - Check that remote users have published their audio streams
   - Verify your speakers/headphones are working

## API Reference

The application uses Agora Web SDK 4.x. For more details, visit:
- [Agora Web SDK Documentation](https://docs.agora.io/en/video-calling/overview/product-overview?platform=web)
- [API Reference](https://docs.agora.io/en/video-calling/reference/web-sdk-reference?platform=web)
