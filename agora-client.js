// Agora client configuration
let agoraClient;
let localAudioTrack;
let remoteUsers = {};
let isMuted = false;

// Hardcoded App ID and token - replace these with your actual values
const AGORA_APP_ID = "3983e52a08424b7da5e79be4c9dfae0f";
const AGORA_TOKEN = "007eJxTYLhzPOLk7SmZplOsdSdNKj7I4bF0/r7XDsJin56Vrkz02s2lwGBsaWGcamqUaGBhYmSSZJ6SaJpqbpmUapJsmZKWmGqQdlPGKqMhkJFh30s1RkYGCATxeRmKSlOKEnVLUotLMvPSGRgAy6QkAA=="; // Use null if you're not using tokens

// Initialize Agora client
function initializeClient() {
    agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    
    // Set up event listeners
    agoraClient.on("user-published", handleUserPublished);
    agoraClient.on("user-unpublished", handleUserUnpublished);
    agoraClient.on("user-left", handleUserLeft);
    agoraClient.on("user-joined", handleUserJoined);
}

// Join channel function
async function joinChannel() {
    try {
        // Use hardcoded App ID and token, only get channel name and UID from input
        const appId = AGORA_APP_ID;
        const token = AGORA_TOKEN;
        const channelName = document.getElementById('channelName').value.trim();
        const uid = document.getElementById('uid').value.trim() || null;
        
        // Validate required fields
        if (!channelName) {
            alert('Please fill in Channel Name');
            return;
        }
        
        updateStatus('Connecting...', 'connecting');
        
        // Initialize client if not already done
        if (!agoraClient) {
            initializeClient();
        }
        
        // Join the channel
        const assignedUid = await agoraClient.join(appId, channelName, token, uid);
        console.log('Successfully joined channel with UID:', assignedUid);
        
        // Create and publish local tracks
        await createAndPublishTracks();
        
        updateStatus('Connected', 'connected');
        updateAudioStatus();
        toggleButtons(true);
        
    } catch (error) {
        console.error('Error joining channel:', error);
        updateStatus('Connection failed: ' + error.message, 'disconnected');
    }
}

// Create and publish local audio tracks
async function createAndPublishTracks() {
    try {
        // Create local audio track only
        localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        
        // Publish audio track to the channel
        await agoraClient.publish([localAudioTrack]);
        console.log('Local audio track published successfully');
        
    } catch (error) {
        console.error('Error creating/publishing tracks:', error);
        throw error;
    }
}

// Leave channel function
async function leaveChannel() {
    try {
        updateStatus('Disconnecting...', 'connecting');
        
        // Stop and close local tracks
        if (localAudioTrack) {
            localAudioTrack.stop();
            localAudioTrack.close();
            localAudioTrack = null;
        }
        
        // Clear remote users
        remoteUsers = {};
        
        // Reset mute state
        isMuted = false;
        
        // Leave the channel
        if (agoraClient) {
            await agoraClient.leave();
        }
        
        updateStatus('Disconnected', 'disconnected');
        updateAudioStatus();
        toggleButtons(false);
        
        console.log('Successfully left the channel');
        
    } catch (error) {
        console.error('Error leaving channel:', error);
        updateStatus('Error disconnecting: ' + error.message, 'disconnected');
    }
}

// Handle when a remote user joins the channel
function handleUserJoined(user) {
    console.log('User joined:', user.uid);
    // Store user (even if they haven't published audio yet)
    remoteUsers[user.uid] = user;
    updateAudioStatus();
}

// Handle when a remote user publishes their stream
async function handleUserPublished(user, mediaType) {
    console.log('User published:', user.uid, mediaType);
    
    // Subscribe to the remote user
    await agoraClient.subscribe(user, mediaType);
    
    // Store remote user
    remoteUsers[user.uid] = user;
    
    if (mediaType === 'audio') {
        // Play remote audio
        const remoteAudioTrack = user.audioTrack;
        remoteAudioTrack.play();
        updateAudioStatus();
    }
}

// Handle when a remote user unpublishes their stream
function handleUserUnpublished(user, mediaType) {
    console.log('User unpublished:', user.uid, mediaType);
    // Keep the user in the list but note they're not publishing
    updateAudioStatus();
}

// Handle when a remote user leaves the channel
function handleUserLeft(user) {
    console.log('User left:', user.uid);
    
    // Remove user from remote users
    delete remoteUsers[user.uid];
    updateAudioStatus();
}

// Update status display
function updateStatus(message, type) {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
}

// Toggle button states
function toggleButtons(connected) {
    document.getElementById('joinBtn').disabled = connected;
    document.getElementById('leaveBtn').disabled = !connected;
    document.getElementById('muteBtn').disabled = !connected;
}

// Update audio status display
function updateAudioStatus() {
    const localAudioStatus = document.getElementById('localAudioStatus');
    const remoteAudioStatus = document.getElementById('remoteAudioStatus');
    
    if (localAudioTrack) {
        localAudioStatus.textContent = `Local Audio: ${isMuted ? 'Muted' : 'On'}`;
    } else {
        localAudioStatus.textContent = 'Local Audio: Off';
    }
    
    const remoteUserCount = Object.keys(remoteUsers).length;
    const activeAudioUsers = Object.values(remoteUsers).filter(user => user.audioTrack).length;
    
    if (remoteUserCount > 0) {
        remoteAudioStatus.textContent = `Remote Users: ${remoteUserCount} connected, ${activeAudioUsers} with audio`;
    } else {
        remoteAudioStatus.textContent = 'Remote Users: 0';
    }
    
    // Log user tracking for debugging
    console.log('Current remote users:', Object.keys(remoteUsers));
    console.log('Users with audio:', Object.values(remoteUsers).filter(user => user.audioTrack).map(user => user.uid));
}

// Toggle mute/unmute
async function toggleMute() {
    if (!localAudioTrack) return;
    
    try {
        if (isMuted) {
            await localAudioTrack.setEnabled(true);
            isMuted = false;
            document.getElementById('muteBtn').textContent = 'Mute';
            document.getElementById('muteBtn').classList.remove('muted');
        } else {
            await localAudioTrack.setEnabled(false);
            isMuted = true;
            document.getElementById('muteBtn').textContent = 'Unmute';
            document.getElementById('muteBtn').classList.add('muted');
        }
        updateAudioStatus();
    } catch (error) {
        console.error('Error toggling mute:', error);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Agora Voice Call Demo loaded');
    updateAudioStatus();
    
    // Add Enter key support for inputs
    const inputs = document.querySelectorAll('input[type="text"]');
    inputs.forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                joinChannel();
            }
        });
    });
});

// Handle page unload
window.addEventListener('beforeunload', function() {
    if (agoraClient) {
        leaveChannel();
    }
});

// Error handling for Agora SDK
AgoraRTC.onAutoplayFailed = () => {
    console.log('Autoplay failed, user interaction required');
    alert('Click anywhere to enable audio/video playback');
};

AgoraRTC.onCameraChanged = (info) => {
    console.log('Camera changed:', info);
};

AgoraRTC.onMicrophoneChanged = (info) => {
    console.log('Microphone changed:', info);
};
