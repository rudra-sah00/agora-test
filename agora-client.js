// Agora client configuration
let agoraClient;
let localAudioTrack;
let remoteUsers = {};
let isMuted = false;
let roomEventLogs = [];
let myUID = null;

// Hardcoded App ID and token - replace these with your actual values
const AGORA_APP_ID = "APP_ID";
const AGORA_TOKEN = "TOKEN"; // Use null if you're not using tokens

// Add room event log
function addRoomLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, message, type };
    roomEventLogs.push(logEntry);
    
    // Keep only last 50 logs
    if (roomEventLogs.length > 50) {
        roomEventLogs.shift();
    }
    
    console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
    updateRoomLogDisplay();
}

// Update room log display in UI
function updateRoomLogDisplay() {
    const logContainer = document.getElementById('roomLogs');
    if (!logContainer) return;
    
    logContainer.innerHTML = '';
    roomEventLogs.slice(-10).forEach(log => { // Show last 10 logs
        const logDiv = document.createElement('div');
        logDiv.className = `log-entry log-${log.type}`;
        logDiv.textContent = `[${log.timestamp}] ${log.message}`;
        logContainer.appendChild(logDiv);
    });
    
    // Auto scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Check if room is empty (excluding ourselves) and auto-leave
function checkRoomAndAutoLeave() {
    const remoteUserCount = Object.keys(remoteUsers).length;
    
    if (remoteUserCount === 0 && localAudioTrack && myUID) {
        addRoomLog('All other users have left the room. Auto-leaving in 3 seconds...', 'warning');
        
        setTimeout(() => {
            if (Object.keys(remoteUsers).length === 0 && localAudioTrack) {
                addRoomLog('Auto-leaving empty room', 'info');
                leaveChannel();
            }
        }, 3000);
    }
}

// Initialize Agora client
function initializeClient() {
    // Create client with enhanced configuration
    agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    
    addRoomLog('Agora client created', 'info');
    
    // Set up ALL possible event listeners for comprehensive tracking
    agoraClient.on("user-published", handleUserPublished);
    agoraClient.on("user-unpublished", handleUserUnpublished);
    agoraClient.on("user-left", handleUserLeft);
    agoraClient.on("user-joined", handleUserJoined);
    
    // Additional event listeners for better tracking
    agoraClient.on("connection-state-change", (curState, revState) => {
        addRoomLog(`Connection state changed: ${revState} -> ${curState}`, 'info');
    });
    
    agoraClient.on("user-info-updated", (uid, msg) => {
        addRoomLog(`User ${uid} info updated: ${msg}`, 'info');
    });
    
    agoraClient.on("media-reconnect-start", (uid) => {
        addRoomLog(`Media reconnect started for user ${uid}`, 'warning');
    });
    
    agoraClient.on("media-reconnect-end", (uid) => {
        addRoomLog(`Media reconnect ended for user ${uid}`, 'success');
    });
    
    agoraClient.on("stream-type-changed", (uid, streamType) => {
        addRoomLog(`User ${uid} stream type changed to ${streamType}`, 'info');
    });
    
    // Network quality indicator
    agoraClient.on("network-quality", (stats) => {
        // Only log significant network changes to avoid spam
        if (stats.downlinkNetworkQuality <= 2 || stats.uplinkNetworkQuality <= 2) {
            addRoomLog(`Network quality: Down=${stats.downlinkNetworkQuality}, Up=${stats.uplinkNetworkQuality}`, 'warning');
        }
    });
    
    // Exception handling
    agoraClient.on("exception", (evt) => {
        addRoomLog(`Agora exception: ${evt.code} - ${evt.msg}`, 'error');
        console.error('Agora exception:', evt);
    });
    
    // Token privilege will expire
    agoraClient.on("token-privilege-will-expire", () => {
        addRoomLog('Token will expire soon - consider renewing', 'warning');
    });
    
    // Token privilege did expire
    agoraClient.on("token-privilege-did-expire", () => {
        addRoomLog('Token has expired - connection may be lost', 'error');
    });
    
    addRoomLog('All event listeners registered', 'success');
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
        addRoomLog(`Attempting to join channel: ${channelName}`, 'info');
        
        // Initialize client if not already done
        if (!agoraClient) {
            addRoomLog('Initializing Agora client...', 'info');
            initializeClient();
        }
        
        // Enhanced join with better error handling
        addRoomLog(`Joining with App ID: ${appId.substring(0, 8)}...`, 'info');
        addRoomLog(`Token present: ${token ? 'Yes' : 'No'}`, 'info');
        
        // Join the channel
        const assignedUid = await agoraClient.join(appId, channelName, token, uid);
        myUID = assignedUid;
        console.log('Successfully joined channel with UID:', assignedUid);
        addRoomLog(`Successfully joined channel "${channelName}" with UID: ${assignedUid}`, 'success');
        
        // Wait a moment for potential existing users to be detected
        addRoomLog('Checking for existing users in channel...', 'info');
        setTimeout(() => {
            const existingUsers = Object.keys(remoteUsers).length;
            addRoomLog(`Found ${existingUsers} existing users in channel`, 'info');
            if (existingUsers === 0) {
                addRoomLog('You are the first user in this channel', 'info');
            }
        }, 2000);
        
        // Create and publish local tracks
        await createAndPublishTracks();
        
        updateStatus('Connected', 'connected');
        updateAudioStatus();
        toggleButtons(true);
        
    } catch (error) {
        console.error('Error joining channel:', error);
        addRoomLog(`Connection failed: ${error.message}`, 'error');
        addRoomLog(`Error code: ${error.code || 'Unknown'}`, 'error');
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
        addRoomLog('Local audio track published successfully', 'success');
        
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
        
        // Reset UID
        myUID = null;
        
        // Add leave log
        addRoomLog('Left the channel', 'info');
        
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
    console.log('User joined event:', user);
    addRoomLog(`User ${user.uid} joined the channel (Platform: ${user.platform || 'Unknown'})`, 'join');
    
    // Store user (even if they haven't published audio yet)
    remoteUsers[user.uid] = {
        ...user,
        joinTime: new Date().toISOString(),
        hasAudio: false,
        hasVideo: false
    };
    
    // Force UI update
    updateAudioStatus();
    updateUserCount();
}

// Handle when a remote user publishes their stream
async function handleUserPublished(user, mediaType) {
    console.log('User published event:', user, mediaType);
    addRoomLog(`User ${user.uid} published ${mediaType}`, 'publish');
    
    try {
        // Subscribe to the remote user
        await agoraClient.subscribe(user, mediaType);
        console.log(`Successfully subscribed to ${user.uid}'s ${mediaType}`);
        
        // Store/update remote user
        if (!remoteUsers[user.uid]) {
            remoteUsers[user.uid] = {
                ...user,
                joinTime: new Date().toISOString(),
                hasAudio: false,
                hasVideo: false
            };
        }
        
        // Update the user object with current data
        remoteUsers[user.uid] = { ...remoteUsers[user.uid], ...user };
        
        if (mediaType === 'audio') {
            remoteUsers[user.uid].hasAudio = true;
            // Play remote audio
            const remoteAudioTrack = user.audioTrack;
            if (remoteAudioTrack) {
                remoteAudioTrack.play();
                addRoomLog(`Now playing audio from user ${user.uid}`, 'audio');
            }
        }
        
        if (mediaType === 'video') {
            remoteUsers[user.uid].hasVideo = true;
            addRoomLog(`Video stream available from user ${user.uid}`, 'publish');
        }
        
        updateAudioStatus();
        updateUserCount();
        
    } catch (error) {
        console.error('Error subscribing to user:', error);
        addRoomLog(`Failed to subscribe to ${user.uid}'s ${mediaType}: ${error.message}`, 'error');
    }
}

// Handle when a remote user unpublishes their stream
function handleUserUnpublished(user, mediaType) {
    console.log('User unpublished event:', user, mediaType);
    addRoomLog(`User ${user.uid} unpublished ${mediaType}`, 'unpublish');
    
    // Update user state
    if (remoteUsers[user.uid]) {
        if (mediaType === 'audio') {
            remoteUsers[user.uid].hasAudio = false;
        }
        if (mediaType === 'video') {
            remoteUsers[user.uid].hasVideo = false;
        }
    }
    
    updateAudioStatus();
    updateUserCount();
}

// Handle when a remote user leaves the channel
function handleUserLeft(user) {
    console.log('User left event:', user);
    addRoomLog(`User ${user.uid} left the channel`, 'leave');
    
    // Remove user from remote users
    delete remoteUsers[user.uid];
    updateAudioStatus();
    updateUserCount();
    
    // Check if room is empty and auto-leave if needed
    checkRoomAndAutoLeave();
}

// New function to update user count in real-time
function updateUserCount() {
    const totalUsers = Object.keys(remoteUsers).length + (myUID ? 1 : 0);
    addRoomLog(`Total users in channel: ${totalUsers} (You + ${Object.keys(remoteUsers).length} remote)`, 'info');
}

// Manual refresh function for debugging
function refreshUserList() {
    addRoomLog('Manually refreshing user list...', 'info');
    
    if (!agoraClient) {
        addRoomLog('No active client connection', 'warning');
        return;
    }
    
    // Get current channel info
    try {
        const channelInfo = agoraClient.channelName;
        addRoomLog(`Current channel: ${channelInfo || 'None'}`, 'info');
        addRoomLog(`Connection state: ${agoraClient.connectionState}`, 'info');
        
        // Force update UI
        updateAudioStatus();
        
        // Log all current state
        console.log('=== MANUAL REFRESH DEBUG ===');
        console.log('Agora client:', agoraClient);
        console.log('Remote users object:', remoteUsers);
        console.log('My UID:', myUID);
        console.log('Local audio track:', localAudioTrack);
        console.log('===========================');
        
    } catch (error) {
        addRoomLog(`Error during refresh: ${error.message}`, 'error');
    }
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
    const userList = document.getElementById('userList');
    
    if (localAudioTrack) {
        localAudioStatus.textContent = `Local Audio: ${isMuted ? 'Muted' : 'On'} (UID: ${myUID || 'Unknown'})`;
    } else {
        localAudioStatus.textContent = 'Local Audio: Off';
    }
    
    const remoteUserCount = Object.keys(remoteUsers).length;
    const activeAudioUsers = Object.values(remoteUsers).filter(user => user.hasAudio || user.audioTrack).length;
    
    if (remoteUserCount > 0) {
        remoteAudioStatus.textContent = `Remote Users: ${remoteUserCount} connected, ${activeAudioUsers} with audio`;
        
        // Enhanced user list with more details
        const userListText = Object.entries(remoteUsers).map(([uid, user]) => {
            const hasAudio = user.hasAudio || user.audioTrack ? '🔊' : '🔇';
            const hasVideo = user.hasVideo || user.videoTrack ? '📹' : '📷';
            const platform = user.platform ? ` (${user.platform})` : '';
            return `${hasAudio}${hasVideo} UID: ${uid}${platform}`;
        }).join(' | ');
        userList.textContent = `Users in room: ${userListText}`;
    } else {
        remoteAudioStatus.textContent = 'Remote Users: 0';
        userList.textContent = myUID ? `Only you in room (UID: ${myUID})` : 'No users in room';
    }
    
    // Enhanced debugging logs
    console.log('=== AUDIO STATUS UPDATE ===');
    console.log('Current remote users:', Object.keys(remoteUsers));
    console.log('Users with audio:', Object.values(remoteUsers).filter(user => user.hasAudio || user.audioTrack).map(user => user.uid || 'Unknown'));
    console.log('My UID:', myUID);
    console.log('Local audio track:', localAudioTrack ? 'Present' : 'None');
    console.log('Remote users detailed:', remoteUsers);
    console.log('============================');
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
            addRoomLog('Microphone unmuted', 'audio');
        } else {
            await localAudioTrack.setEnabled(false);
            isMuted = true;
            document.getElementById('muteBtn').textContent = 'Unmute';
            document.getElementById('muteBtn').classList.add('muted');
            addRoomLog('Microphone muted', 'audio');
        }
        updateAudioStatus();
    } catch (error) {
        console.error('Error toggling mute:', error);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Agora Voice Call Demo loaded');
    addRoomLog('Application loaded and ready', 'info');
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
        addRoomLog('Page unloading, leaving channel', 'warning');
        leaveChannel();
    }
});

// Error handling for Agora SDK
AgoraRTC.onAutoplayFailed = () => {
    console.log('Autoplay failed, user interaction required');
    addRoomLog('Autoplay failed, user interaction required', 'warning');
    alert('Click anywhere to enable audio/video playback');
};

AgoraRTC.onCameraChanged = (info) => {
    console.log('Camera changed:', info);
    addRoomLog(`Camera changed: ${info.device ? info.device.label : 'Unknown device'}`, 'info');
};

AgoraRTC.onMicrophoneChanged = (info) => {
    console.log('Microphone changed:', info);
    addRoomLog(`Microphone changed: ${info.device ? info.device.label : 'Unknown device'}`, 'info');
};
