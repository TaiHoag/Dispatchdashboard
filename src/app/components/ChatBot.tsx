import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { Emergency, Vehicle } from '../types';
import { GoogleGenAI } from '@google/genai';

interface ChatBotProps {
  emergencies: Emergency[];
  vehicles: Vehicle[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatBot({ emergencies, vehicles }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || '');
  const [isConfiguring, setIsConfiguring] = useState(!import.meta.env.VITE_GEMINI_API_KEY);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const generateContextPrompt = () => {
    // Sort pending by urgency score descending
    const pending = emergencies
      .filter(e => e.status === 'pending')
      .sort((a, b) => (b.urgencyScore || 0) - (a.urgencyScore || 0));
    
    const dispatched = emergencies.filter(e => e.status === 'dispatched');
    const resolved = emergencies.filter(e => e.status === 'resolved');
    
    const pendingDetails = pending.map(e => 
      `[ID: ${e.id}] ${e.type} | Urgency: ${e.urgencyScore} | Wait: ${e.waitingDays} days | Victims: ${e.victims.normal} norm, ${e.victims.childrenElders} vul, ${e.victims.injured} inj, ${e.victims.immediateHelp} crit | Danger: ${e.areaDangerScore}`
    );

    const vehiclesDetails = vehicles.map(v => 
      `[ID: ${v.id}] ${v.name} (${v.type}, Cap: ${v.capacity}kg, ${v.available ? 'Available' : 'Busy'})`
    );

    return `Dashboard State:
- Emergencies: ${pending.length} pending, ${dispatched.length} dispatched, ${resolved.length} resolved.

Top Pending Emergencies:
${pendingDetails.slice(0, 10).join('\n')}

Vehicles: ${vehicles.filter(v => v.available).length} available / ${vehicles.length} total.
${vehiclesDetails.join('\n')}

Directives:
- Output RAW TEXT ONLY. Do NOT use any Markdown formatting (no asterisks **, no hashes #, no bold, etc.).
- Be extremely short, simple, and comprehensive.
- Use simple text dashes (-) for lists instead of markdown bullets.
- Highlight urgent warnings first (focus on high waiting days, immediateHelp victims, or high danger scores).
- Provide direct, actionable dispatch suggestions with specific vehicle IDs and Emergency IDs.
- Do NOT use conversational filler (e.g., "Here is the analysis").`;
  };

  const handleSend = async () => {
    if (!input.trim() || !apiKey) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      
      const systemInstruction = generateContextPrompt();
      const prompt = `System Context:\n${systemInstruction}\n\nUser Question:\n${userMsg}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response.text || 'No response generated.' }]);
    } catch (error) {
      console.error('Error generating AI content:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error instanceof Error ? error.message : 'Failed to connect to Gemini API.'}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const processInitialAnalysis = async () => {
    if (!apiKey) return;
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const systemInstruction = generateContextPrompt();
      const prompt = `System Context:\n${systemInstruction}\n\nProvide an initial briefing: 1-2 raw text items for urgent warnings, and 1-2 raw text items for immediate dispatch actions. No markdown formatting.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      setMessages([{ role: 'assistant', content: response.text || 'I am ready to assist with dispatch operations.' }]);
    } catch (error) {
      console.error('Error with initial analysis:', error);
      setMessages([{ role: 'assistant', content: 'Ready to assist, but encountered an error connecting to Gemini.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Run initial analysis when opening for the first time if no messages
  useEffect(() => {
    if (isOpen && messages.length === 0 && !isConfiguring && apiKey) {
      processInitialAnalysis();
    }
  }, [isOpen, messages.length, apiKey, isConfiguring, emergencies]); // Added emergencies to auto-refresh maybe? No, let's keep it simple

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="absolute bottom-4 right-4 z-[50] p-4 bg-black text-white hover:bg-gray-800 rounded-full shadow-[4px_4px_0_0_#000000] border-2 border-black transition-transform hover:scale-105"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {isOpen && (
        <div className="absolute bottom-20 right-4 z-[50] w-80 sm:w-96 h-[500px] bg-white border-2 border-black shadow-[8px_8px_0_0_#000000] flex flex-col">
          <div className="flex items-center justify-between p-3 border-b-2 border-black bg-[#F4F5F0]">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <span className="font-bold uppercase tracking-tight">AI Assistant</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsConfiguring(!isConfiguring)}
                className="text-xs font-bold uppercase underline"
              >
                API Key
              </button>
              <button onClick={() => setIsOpen(false)} className="hover:bg-gray-200 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {isConfiguring ? (
            <div className="p-4 flex-1 flex flex-col gap-4">
              <h3 className="font-bold text-sm uppercase">Configure Gemini AI</h3>
              <p className="text-sm">Please provide a Gemini API Key to enable AI analysis and suggestions.</p>
              <input
                type="password"
                placeholder="Enter Gemini API Key..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="w-full p-2 border-2 border-black focus:outline-none"
              />
              <button
                onClick={() => setIsConfiguring(false)}
                disabled={!apiKey}
                className="w-full py-2 bg-black text-white font-bold uppercase border-2 border-black hover:bg-gray-800 disabled:opacity-50"
              >
                Save & Continue
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}
                    <div className={`p-3 max-w-[80%] border-2 border-black ${msg.role === 'user' ? 'bg-[#C8F7C5] shadow-[2px_2px_0_0_#000000]' : 'bg-white shadow-[2px_2px_0_0_#000000]'}`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-[#FFE066] border-2 border-black flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="p-3 border-2 border-black bg-white shadow-[2px_2px_0_0_#000000] flex items-center gap-2">
                      <span className="text-sm font-bold uppercase">Analyzing</span>
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t-2 border-black bg-[#F4F5F0]">
                <div className="flex gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask for suggestions..."
                    className="flex-1 resize-none h-[42px] min-h-[42px] max-h-[84px] p-2 text-sm border-2 border-black shadow-[2px_2px_0_0_#000000] focus:outline-none"
                    rows={1}
                  />
                  <button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="p-2 h-[42px] bg-black text-white border-2 border-black shadow-[2px_2px_0_0_#000000] hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}