import { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

export interface LiveVoiceOptions {
  voice?: 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';
  systemInstruction?: string;
}

export function setupLiveVoiceService(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/live' });

  wss.on('connection', async (clientWs: WebSocket) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: 'error',
            error: 'GEMINI_API_KEY is not configured on the server. Please configure it in your environment.',
          })
        );
        clientWs.close();
      }
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    let liveSession: any = null;
    let isConnected = false;

    const connectLiveSession = async (options: LiveVoiceOptions = {}) => {
      try {
        const voiceName = options.voice || 'Zephyr';
        const systemInstruction =
          options.systemInstruction ||
          'You are VELORA AI, an expressive, highly intelligent creative partner and studio director. You assist with cinematic storytelling, camera direction, prompt engineering, visual art concepts, and real-time conversation. Speak naturally, warmly, concisely, and with conversational cadence.';

        liveSession = await ai.live.connect({
          model: 'gemini-3.8-live',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
            systemInstruction,
            outputAudioTranscription: {},
            inputAudioTranscription: {},
          },
          callbacks: {
            onmessage: (message: LiveServerMessage) => {
              if (clientWs.readyState !== WebSocket.OPEN) return;

              // 1. Audio stream chunks from model (24kHz PCM)
              const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audioData) {
                clientWs.send(
                  JSON.stringify({
                    type: 'audio',
                    audio: audioData,
                  })
                );
              }

              // 2. Interruption event
              if (message.serverContent?.interrupted) {
                clientWs.send(
                  JSON.stringify({
                    type: 'interrupted',
                    interrupted: true,
                  })
                );
              }

              // 3. Model turn transcription
              const serverContent = message.serverContent as any;
              if (serverContent?.outputAudioTranscription?.text) {
                clientWs.send(
                  JSON.stringify({
                    type: 'transcription',
                    role: 'assistant',
                    text: serverContent.outputAudioTranscription.text,
                  })
                );
              }

              // 4. User input transcription
              if (serverContent?.inputAudioTranscription?.text) {
                clientWs.send(
                  JSON.stringify({
                    type: 'transcription',
                    role: 'user',
                    text: serverContent.inputAudioTranscription.text,
                  })
                );
              }
            },
            onclose: () => {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ type: 'session_closed' }));
              }
            },
            onerror: (err: any) => {
              console.error('Gemini Live session callback error:', err);
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(
                  JSON.stringify({
                    type: 'error',
                    error: err?.message || 'Live API communication error',
                  })
                );
              }
            },
          },
        });

        isConnected = true;
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              type: 'ready',
              model: 'gemini-3.8-live',
              voice: voiceName,
            })
          );
        }
      } catch (err: any) {
        console.error('Failed to establish Gemini Live connection:', err);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              type: 'error',
              error: err?.message || 'Failed to connect to Gemini Live API.',
            })
          );
          clientWs.close();
        }
      }
    };

    // Auto-connect with default settings
    await connectLiveSession();

    // Listen to client messages
    clientWs.on('message', async (rawData: any) => {
      try {
        const msg = JSON.parse(rawData.toString());

        // Handle init/config updates
        if (msg.type === 'init' || msg.type === 'config') {
          if (liveSession) {
            try {
              liveSession.close();
            } catch {}
          }
          await connectLiveSession({ voice: msg.voice, systemInstruction: msg.systemInstruction });
          return;
        }

        if (!liveSession || !isConnected) return;

        // User spoken audio chunk (16kHz PCM little-endian base64)
        if ((msg.type === 'audio' || msg.audio) && (msg.audio || msg.data)) {
          const audioPayload = msg.audio || msg.data;
          liveSession.sendRealtimeInput({
            audio: {
              data: audioPayload,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        }

        // Text prompt fallback
        if (msg.type === 'text' && msg.text) {
          liveSession.sendRealtimeInput({
            text: msg.text,
          });
        }
      } catch (err) {
        console.error('Error handling WebSocket client message:', err);
      }
    });

    clientWs.on('close', () => {
      if (liveSession) {
        try {
          liveSession.close();
        } catch {}
      }
    });

    clientWs.on('error', (err) => {
      console.error('Client WebSocket error:', err);
      if (liveSession) {
        try {
          liveSession.close();
        } catch {}
      }
    });
  });

  return wss;
}
