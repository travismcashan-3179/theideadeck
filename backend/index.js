import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';

const app = express();
const PORT = 3001;
const DATA_FILE = path.resolve('./data/ideas.json');
const CHAT_FILE = path.resolve('./data/chat.json');

app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://theideadeck.vercel.app',
      'https://theideadeck.onrender.com'
    ];
    // Allow all Vercel preview deployments for this project
    if (
      allowedOrigins.includes(origin) ||
      /^https:\/\/theideadeck-[a-z0-9]+-travis-mcashans-projects\.vercel\.app$/.test(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(bodyParser.json());
app.use('/uploads', express.static(path.resolve('uploads')));

// Ensure data directory and file exist
if (!fs.existsSync('./data')) fs.mkdirSync('./data');
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');
if (!fs.existsSync(CHAT_FILE)) fs.writeFileSync(CHAT_FILE, '[]');

function readIdeas() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}
function writeIdeas(ideas) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(ideas, null, 2));
}

function readChat() {
  return JSON.parse(fs.readFileSync(CHAT_FILE, 'utf-8'));
}
function writeChat(chat) {
  fs.writeFileSync(CHAT_FILE, JSON.stringify(chat, null, 2));
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const upload = multer({ dest: 'uploads/' });

// List all ideas
app.get('/ideas', (req, res) => {
  res.json(readIdeas());
});

// Add a new idea
app.post('/ideas', (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });
  const ideas = readIdeas();
  const newIdea = {
    id: Date.now().toString(),
    text,
    createdAt: new Date().toISOString(),
    used: false
  };
  ideas.unshift(newIdea);
  writeIdeas(ideas);
  res.json(newIdea);
});

// Mark idea as used
app.put('/ideas/:id/used', (req, res) => {
  const { id } = req.params;
  const ideas = readIdeas();
  const idx = ideas.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  ideas[idx].used = true;
  writeIdeas(ideas);
  res.json(ideas[idx]);
});

// Delete idea
app.delete('/ideas/:id', (req, res) => {
  const { id } = req.params;
  let ideas = readIdeas();
  const idx = ideas.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const [deleted] = ideas.splice(idx, 1);
  writeIdeas(ideas);
  res.json(deleted);
});

// Delete all ideas
app.delete('/ideas', (req, res) => {
  writeIdeas([]);
  res.json({ success: true });
});

// Get all chat history
app.get('/chat', (req, res) => {
  res.json(readChat());
});

// Add a chat message
app.post('/chat', (req, res) => {
  const { sender, text, type, gif, createdAt } = req.body;
  if (!sender || !text) return res.status(400).json({ error: 'sender and text required' });
  const chat = readChat();
  const msg = { id: uuidv4(), sender, text, createdAt: createdAt || new Date().toISOString() };
  if (type) msg.type = type;
  if (gif) msg.gif = gif;
  chat.push(msg);
  writeChat(chat);
  res.json(msg);
});

// Update a chat message by ID
app.patch('/chat/:id', (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  const chat = readChat();
  const idx = chat.findIndex(m => m.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Message not found' });
  chat[idx].text = text;
  writeChat(chat);
  res.json(chat[idx]);
});

// PATCH: Update idea meta fields
app.patch('/ideas/:id', (req, res) => {
  const { id } = req.params;
  const allowedFields = ['type', 'topic', 'intent', 'status', 'audience'];
  const updates = req.body;
  const ideas = readIdeas();
  const idx = ideas.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  let updated = false;
  for (const field of allowedFields) {
    if (field in updates) {
      ideas[idx][field] = updates[field];
      updated = true;
    }
  }
  if (!updated) return res.status(400).json({ error: 'No valid fields to update' });
  writeIdeas(ideas);
  res.json(ideas[idx]);
});

app.post('/agent', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  // Always ask AI to decide if this is a list of ideas or a chat message
  try {
    // Allowed values for meta fields
    const POST_TYPES = ["Story", "How-to", "List", "Question", "Announcement", "Opinion", "Inspire", "Collab"];
    const CONTENT_TOPICS = ["Leadership", "Career", "Productivity", "Trends", "Culture", "AI", "Marketing", "Branding"];
    const INTENTS = ["Inspire", "Educate", "Engage", "Promote", "Network", "Entertain"];
    const STATUSES = ["New", "Drafted", "Scheduled", "Posted", "Archived"];
    const AUDIENCES = ["Peers", "Leaders", "Clients", "Job Seekers", "Public"];
    const extractPrompt = `You are an expert LinkedIn content strategist. The user may send you a list of LinkedIn post ideas, a brain dump, or a chat message.\n\nIf the message contains a list of post ideas (even if short, unpunctuated, or separated by lines/dashes), extract all distinct LinkedIn post ideas and for each, return a JSON object with these fields: text, type, topic, intent, status (default to 'New'), and audience.\n\nFor each field, ONLY choose from these allowed values:\n- type: ${POST_TYPES.join(", ")}\n- topic: ${CONTENT_TOPICS.join(", ")}\n- intent: ${INTENTS.join(", ")}\n- status: ${STATUSES.join(", ")}\n- audience: ${AUDIENCES.join(", ")}\n\nReturn ONLY a JSON array of objects, one per idea. Use short, clear values for each field. If it is not a list of ideas, reply conversationally as yourself. Do not include any explanation or extra text outside the JSON array if extracting ideas.\n\nText:\n${message}`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are an expert LinkedIn content strategist.' },
        { role: 'user', content: extractPrompt }
      ],
      temperature: 0.3
    });
    const aiContent = completion.choices[0].message.content.trim();
    let ideasArr = [];
    let isIdeas = false;
    try {
      ideasArr = JSON.parse(aiContent);
      isIdeas = Array.isArray(ideasArr) && ideasArr.length > 0;
    } catch (e) {
      // Try to extract JSON array from text
      const match = aiContent.match(/\[([\s\S]*?)\]/);
      if (match) {
        try {
          ideasArr = JSON.parse(match[0]);
          isIdeas = Array.isArray(ideasArr) && ideasArr.length > 0;
        } catch (e2) {}
      }
    }
    if (isIdeas) {
      const ideas = readIdeas();
      const now = new Date().toISOString();
      // For each extracted idea, generate a hook and store meta fields
      const newIdeas = [];
      for (const ideaObj of ideasArr) {
        const original = ideaObj.text || ideaObj.idea || ideaObj.hook || '';
        let hook = original;
        // If the original is long, multi-line, or a list, rewrite it as a single catchy sentence
        const isShortSingleSentence =
          typeof original === 'string' &&
          original.length < 100 &&
          !original.includes('\n') &&
          !/^[-*•]/.test(original.trim()) &&
          original.split('.').length <= 2;
        if (!isShortSingleSentence) {
          try {
            const rewritePrompt = `If the following text is already a single, short, catchy sentence, return it unchanged. If it is long, multi-line, a list, or a paragraph, rewrite it as a single, catchy sentence suitable as a LinkedIn post idea title.\n\nText:\n${original}`;
            const rewriteCompletion = await openai.chat.completions.create({
              model: 'gpt-3.5-turbo',
              messages: [
                { role: 'system', content: 'You are an expert LinkedIn content strategist.' },
                { role: 'user', content: rewritePrompt }
              ],
              temperature: 0.3
            });
            hook = rewriteCompletion.choices[0].message.content.trim();
          } catch (e) {}
        }
        newIdeas.push({
          id: Date.now().toString() + Math.random().toString().slice(2, 8),
          hook,
          original,
          createdAt: now,
          used: false,
          type: ideaObj.type || '',
          topic: ideaObj.topic || '',
          intent: ideaObj.intent || '',
          status: ideaObj.status || 'New',
          audience: ideaObj.audience || ''
        });
      }
      newIdeas.forEach(idea => ideas.unshift(idea));
      writeIdeas(ideas);
      // Save to chat history
      const chat = readChat();
      const hooksList = newIdeas.map(idea => `• ${idea.hook}`).join('\n');
      const replyText = `Imported ${newIdeas.length} new ideas!\n\n${hooksList}`;
      // Ensure AI reply is always after the latest message
      const lastMsg = chat[chat.length - 1];
      const aiCreatedAt = lastMsg && lastMsg.createdAt
        ? new Date(new Date(lastMsg.createdAt).getTime() + 1).toISOString()
        : new Date().toISOString();
      chat.push({ sender: 'agent', text: replyText, createdAt: aiCreatedAt });
      writeChat(chat);
      return res.json({ reply: replyText });
    } else {
      // Not a list, reply as chat
      // Load last 10 chat messages for context
      const chatHistory = readChat().slice(-10);
      const context = chatHistory.map(m => `${m.sender === 'user' ? 'User' : 'Agent'}: ${m.text}`).join('\n');
      const prompt = `You are LinkedList, a friendly, smart assistant who helps users brainstorm, organize, and manage LinkedIn post ideas.\n\nYou can chat naturally, give encouragement, and help with content strategy.\n\nIf the user wants to add, list, mark, or delete an idea, you can do it. Otherwise, just reply conversationally.\n\nHere is the recent chat history for context:\n${context}\n\nUser: ${message}`;
      const chatCompletion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are LinkedList, a friendly, smart assistant for LinkedIn post ideas. You can chat naturally, help brainstorm, and manage ideas. If you need to perform an action, reply with a JSON object. Otherwise, just reply as yourself.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      });
      const aiReply = chatCompletion.choices[0].message.content.trim();
      const chat = readChat();
      // Ensure AI reply is always after the latest message
      const lastMsg = chat[chat.length - 1];
      const aiCreatedAt = lastMsg && lastMsg.createdAt
        ? new Date(new Date(lastMsg.createdAt).getTime() + 1).toISOString()
        : new Date().toISOString();
      chat.push({ sender: 'agent', text: aiReply, createdAt: aiCreatedAt });
      writeChat(chat);
      return res.json({ reply: aiReply });
    }
  } catch (err) {
    console.error('AI extraction error:', err);
    return res.status(500).json({ reply: 'AI error during idea extraction.' });
  }
});

app.post('/transcribe', upload.single('audio'), async (req, res) => {
  console.log('Received /transcribe request');
  if (!req.file) {
    console.log('No audio file uploaded');
    return res.status(400).json({ error: 'No audio file uploaded' });
  }
  const inputPath = req.file.path;
  const outputPath = inputPath + '.wav';
  try {
    // Convert to WAV using ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('wav')
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath);
    });
    console.log('Converted to WAV:', outputPath);
    // Send WAV to OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(outputPath),
      model: 'whisper-1',
      response_format: 'text',
      language: 'en'
    });
    fs.unlinkSync(inputPath); // Clean up original file
    fs.unlinkSync(outputPath); // Clean up wav file
    console.log('Transcription result:', transcription);
    res.json({ text: transcription.data || transcription });
  } catch (err) {
    console.error('Transcription failed:', err);
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    res.status(500).json({ error: 'Transcription failed', details: err.message });
  }
});

// Upload image for an idea
app.post('/ideas/:id/image', upload.single('image'), (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const ideas = readIdeas();
  const idx = ideas.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Idea not found' });
  // Save image path (relative URL)
  const imageUrl = `/uploads/${req.file.filename}`;
  ideas[idx].imageUrl = imageUrl;
  writeIdeas(ideas);
  res.json(ideas[idx]);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
}); 