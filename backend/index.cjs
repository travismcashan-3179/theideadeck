const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const csvParse = require('csv-parse/sync');

const app = express();
const PORT = 3001;
const DATA_FILE = path.resolve('./data/ideas.json');
const CHAT_FILE = path.resolve('./data/chat.json');
const tagsPath = path.join(__dirname, 'data', 'tags.json');

app.use(cors({
  origin: function (origin, callback) {
    console.log('CORS request from:', origin); // Debug log
    const allowedOrigins = [
      'https://theideadeck.vercel.app',
      'https://theideadeck.onrender.com'
    ];
    // Allow requests with no origin (like direct API/browser calls)
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      /^https:\/\/theideadeck(-[a-z0-9-]+)?-travis-mcashans-projects\.vercel\.app$/.test(origin)
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
    res.json({ text: transcription.text || transcription });
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

// SMS Webhook for TextBelt
app.post('/sms-webhook', async (req, res) => {
  console.log('Received /sms-webhook POST:', JSON.stringify(req.body));
  const from = req.body.from || req.body.fromNumber;
  const text = req.body.text;
  if (!from || !text) return res.status(400).json({ error: 'from and text required' });

  // Atomic chat history update: read once, push both user and bot messages, write once
  const chat = readChat();
  const now = new Date().toISOString();
  // Save incoming SMS as a user message
  chat.push({
    id: uuidv4(),
    sender: 'user',
    text,
    createdAt: now
  });

  try {
    console.log('Starting OpenAI processing for SMS reply...');
    // Allowed values for meta fields
    const POST_TYPES = ["Story", "How-to", "List", "Question", "Announcement", "Opinion", "Inspire", "Collab"];
    const CONTENT_TOPICS = ["Leadership", "Career", "Productivity", "Trends", "Culture", "AI", "Marketing", "Branding"];
    const INTENTS = ["Inspire", "Educate", "Engage", "Promote", "Network", "Entertain"];
    const STATUSES = ["New", "Drafted", "Scheduled", "Posted", "Archived"];
    const AUDIENCES = ["Peers", "Leaders", "Clients", "Job Seekers", "Public"];
    const extractPrompt = `You are an expert LinkedIn content strategist. The user may send you a list of LinkedIn post ideas, a brain dump, or a chat message.\n\nIf the message contains a list of post ideas (even if short, unpunctuated, or separated by lines/dashes), extract all distinct LinkedIn post ideas and for each, return a JSON object with these fields: text, type, topic, intent, status (default to 'New'), and audience.\n\nFor each field, ONLY choose from these allowed values:\n- type: ${POST_TYPES.join(", ")}\n- topic: ${CONTENT_TOPICS.join(", ")}\n- intent: ${INTENTS.join(", ")}\n- status: ${STATUSES.join(", ")}\n- audience: ${AUDIENCES.join(", ")}\n\nReturn ONLY a JSON array of objects, one per idea. Use short, clear values for each field. If it is not a list of ideas, reply conversationally as yourself. Do not include any explanation or extra text outside the JSON array if extracting ideas.\n\nText:\n${text}`;
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are an expert LinkedIn content strategist.' },
          { role: 'user', content: extractPrompt }
        ],
        temperature: 0.3
      });
      console.log('OpenAI completion received.');
    } catch (err) {
      console.error('OpenAI API error:', err);
      throw err;
    }
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
    let replyText = '';
    if (isIdeas) {
      const now2 = new Date(new Date(now).getTime() + 1).toISOString();
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
              model: 'gpt-4o',
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
          createdAt: now2,
          used: false,
          type: ideaObj.type || '',
          topic: ideaObj.topic || '',
          intent: ideaObj.intent || '',
          status: ideaObj.status || 'New',
          audience: ideaObj.audience || ''
        });
      }
      // Save to chat history
      const hooksList = newIdeas.map(idea => `• ${idea.hook}`).join('\n');
      replyText = `Imported ${newIdeas.length} new ideas!\n\n${hooksList}`;
      // Ensure AI reply is always after the latest message
      chat.push({ sender: 'agent', text: replyText, createdAt: now2 });
    } else {
      // Not a list, reply as chat
      // Load last 10 chat messages for context
      const chatHistory = chat.slice(-10);
      const context = chatHistory.map(m => `${m.sender === 'user' ? 'User' : 'Agent'}: ${m.text}`).join('\n');
      const prompt = `You are LinkedList, a friendly, smart assistant who helps users brainstorm, organize, and manage LinkedIn post ideas.\n\nYou can chat naturally, give encouragement, and help with content strategy.\n\nIf the user wants to add, list, mark, or delete an idea, you can do it. Otherwise, just reply conversationally.\n\nHere is the recent chat history for context:\n${context}\n\nUser: ${text}`;
      let chatCompletion;
      try {
        chatCompletion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are LinkedList, a friendly, smart assistant for LinkedIn post ideas. You can chat naturally, help brainstorm, and manage ideas. If you need to perform an action, reply with a JSON object. Otherwise, just reply as yourself.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7
        });
        console.log('OpenAI chat completion received.');
      } catch (err) {
        console.error('OpenAI chat API error:', err);
        throw err;
      }
      const now2 = new Date(new Date(now).getTime() + 1).toISOString();
      replyText = chatCompletion.choices[0].message.content.trim();
      chat.push({ sender: 'agent', text: replyText, createdAt: now2 });
    }
    // Write chat history once, after both user and agent messages
    writeChat(chat);
    console.log('About to send SMS reply via TextBelt:', replyText);
    await axios.post('https://textbelt.com/text', {
      phone: from,
      message: replyText,
      key: process.env.TEXTBELT_KEY,
      replyWebhookUrl: process.env.RENDER_WEBHOOK_URL || 'https://theideadeck.onrender.com/sms-webhook',
      sender: 'glidedesign.com'
    });
    console.log('SMS reply sent successfully.');
    res.json({ success: true });
  } catch (err) {
    console.error('SMS webhook error:', err);
    res.status(500).json({ error: 'SMS webhook error', details: err.message });
  }
});

// Test endpoint to send an SMS to 5127798177
app.get('/test-sms', async (req, res) => {
  try {
    const response = await axios.post('https://textbelt.com/text', {
      phone: '5127798177',
      message: 'This is a test from your backend. Reply to this message to test SMS mirroring.',
      key: process.env.TEXTBELT_KEY,
      replyWebhookUrl: process.env.RENDER_WEBHOOK_URL || 'https://theideadeck.onrender.com/sms-webhook',
      sender: 'glidedesign.com'
    });
    res.json(response.data);
  } catch (err) {
    console.error('Test SMS error:', err);
    res.status(500).json({ error: 'Failed to send test SMS', details: err.message });
  }
});

app.post('/api/analyze-linkedin', upload.fields([
  { name: 'profile', maxCount: 1 },
  { name: 'posts', maxCount: 1 }
]), async (req, res) => {
  try {
    // Parse PDF
    const profilePath = req.files.profile[0].path;
    const profileBuffer = fs.readFileSync(profilePath);
    const profileText = (await pdfParse(profileBuffer)).text;

    // Parse CSV
    const postsPath = req.files.posts[0].path;
    const postsCsv = fs.readFileSync(postsPath, 'utf8');
    const postsRows = csvParse.parse(postsCsv, { columns: true });
    const postsText = postsRows.map(row => row.Text || row.Content || '').join('\n');

    // Compose prompt
    const prompt = `
Given the following LinkedIn profile and posts, extract the following as short, clear, first-person phrases (not about the user, but as if written by the user, no fluff):\n- Discipline: What do you do? (e.g. 'web design and development, digital marketing')\n- Market: Who do you do it for? (e.g. 'startups, nonprofits, beloved brands')\n\nReturn only the facts, no extra explanation.\n\nProfile:\n${profileText}\n\nPosts:\n${postsText}`;

    // Call OpenAI
    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
    });

    const aiText = aiRes.choices[0].message.content;

    // Simple extraction
    const result = {};
    ['Discipline', 'Market', 'Ideal Customer Profile', 'Topic Pillars'].forEach(key => {
      const match = aiText.match(new RegExp(`${key}:\\s*([\\s\\S]*?)(?=\\n[A-Z]|$)`, 'i'));
      if (match) result[key.replace(/ /g, '').replace('IdealCustomerProfile', 'customerProfile').replace('TopicPillars', 'topicPillars').toLowerCase()] = match[1].trim();
    });

    res.json({
      discipline: result.discipline || '',
      market: result.market || '',
      customerProfile: result.customerProfile || '',
      topicPillars: result.topicPillars || '',
    });

    // Clean up files
    fs.unlinkSync(profilePath);
    fs.unlinkSync(postsPath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to analyze files' });
  }
});

// Analyze discipline and market only
app.post('/api/analyze-discipline-market', upload.fields([
  { name: 'profile', maxCount: 1 },
  { name: 'posts', maxCount: 1 }
]), async (req, res) => {
  try {
    const profilePath = req.files.profile[0].path;
    const profileBuffer = fs.readFileSync(profilePath);
    const profileText = (await pdfParse(profileBuffer)).text;

    const postsPath = req.files.posts[0].path;
    const postsCsv = fs.readFileSync(postsPath, 'utf8');
    const postsRows = csvParse.parse(postsCsv, { columns: true });
    const postsText = postsRows.map(row => row.Text || row.Content || '').join('\n');

    const prompt = `Given the following LinkedIn profile and posts, extract:\n1. The user's discipline.\n2. The user's market.\n\nProfile:\n${profileText}\n\nPosts:\n${postsText}`;

    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
    });

    const aiText = aiRes.choices[0].message.content;
    const result = {};
    ['Discipline', 'Market'].forEach(key => {
      const match = aiText.match(new RegExp(`${key}:\\s*([\\s\\S]*?)(?=\\n[A-Z]|$)`, 'i'));
      if (match) result[key.toLowerCase()] = match[1].trim();
    });

    res.json({
      discipline: result.discipline || '',
      market: result.market || ''
    });

    fs.unlinkSync(profilePath);
    fs.unlinkSync(postsPath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to analyze discipline and market' });
  }
});

// Analyze topic pillars and customer profile only
app.post('/api/analyze-topic-pillars', upload.fields([
  { name: 'posts', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('analyze-topic-pillars req.files:', req.files);
    console.log('analyze-topic-pillars req.body:', req.body);

    // Defensive: check for file presence
    if (
      !req.files ||
      typeof req.files !== 'object' ||
      !req.files.posts ||
      !Array.isArray(req.files.posts) ||
      !req.files.posts.length ||
      !req.files.posts[0]
    ) {
      return res.status(400).json({ error: 'No posts file uploaded. Please upload a CSV file with the field name "posts".' });
    }

    const postsPath = req.files.posts[0].path;
    const postsCsv = fs.readFileSync(postsPath, 'utf8');
    if (!postsCsv.trim()) {
      fs.unlinkSync(postsPath);
      return res.status(400).json({ error: 'Uploaded posts file is empty.' });
    }
    let postsRows;
    try {
      postsRows = csvParse.parse(postsCsv, { columns: true });
    } catch (parseErr) {
      fs.unlinkSync(postsPath);
      console.error('CSV parse error:', parseErr);
      return res.status(400).json({ error: 'Uploaded file is not a valid CSV.' });
    }
    const postsText = postsRows.map(row => row.ShareCommentary || row.Text || row.Content || '').join('\n');
    if (!postsText.trim()) {
      fs.unlinkSync(postsPath);
      return res.status(400).json({ error: 'No post content found in CSV.' });
    }
    const prompt = `Given the following LinkedIn posts, extract 3-5 short, clear, first-person keywords that best describe your main topic pillars. No extra explanation.\n\nPosts:\n${postsText}`;
    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
    });
    const aiText = aiRes.choices[0].message.content.trim();
    res.json({ topicPillars: aiText });
    fs.unlinkSync(postsPath);
  } catch (err) {
    console.error('analyze-topic-pillars error:', err);
    res.status(500).json({ error: 'Failed to analyze topic pillars', details: err.message, stack: err.stack });
  }
});

// Analyze discipline (profile only)
app.post('/api/analyze-discipline', upload.fields([
  { name: 'profile', maxCount: 1 }
]), async (req, res) => {
  try {
    const profilePath = req.files.profile[0].path;
    const profileBuffer = fs.readFileSync(profilePath);
    const profileText = (await pdfParse(profileBuffer)).text;
    const prompt = `Given the following LinkedIn profile, extract 3-5 short, clear, first-person keywords that best describe what you do (your discipline). No extra explanation.\n\nProfile:\n${profileText}`;
    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
    });
    const aiText = aiRes.choices[0].message.content.trim();
    res.json({ discipline: aiText });
    fs.unlinkSync(profilePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to analyze discipline' });
  }
});

// Analyze market (profile only)
app.post('/api/analyze-market', upload.fields([
  { name: 'profile', maxCount: 1 }
]), async (req, res) => {
  try {
    const profilePath = req.files.profile[0].path;
    const profileBuffer = fs.readFileSync(profilePath);
    const profileText = (await pdfParse(profileBuffer)).text;
    const prompt = `Given the following LinkedIn profile, extract 3-5 short, clear, first-person keywords that best describe who you do it for (your core market). No extra explanation.\n\nProfile:\n${profileText}`;
    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
    });
    const aiText = aiRes.choices[0].message.content.trim();
    res.json({ market: aiText });
    fs.unlinkSync(profilePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to analyze market' });
  }
});

// Analyze ICP (profile + posts)
app.post('/api/analyze-icp', upload.fields([
  { name: 'profile', maxCount: 1 },
  { name: 'posts', maxCount: 1 }
]), async (req, res) => {
  try {
    const profilePath = req.files.profile[0].path;
    const profileBuffer = fs.readFileSync(profilePath);
    const profileText = (await pdfParse(profileBuffer)).text;
    const postsPath = req.files.posts[0].path;
    const postsCsv = fs.readFileSync(postsPath, 'utf8');
    const postsRows = csvParse.parse(postsCsv, { columns: true });
    const postsText = postsRows.map(row => row.Text || row.Content || '').join('\n');
    const prompt = `Given the following LinkedIn profile and posts, extract 3-5 short, clear, first-person keywords that best describe your ideal customer profile. No extra explanation.\n\nProfile:\n${profileText}\n\nPosts:\n${postsText}`;
    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
    });
    const aiText = aiRes.choices[0].message.content.trim();
    res.json({ customerProfile: aiText });
    fs.unlinkSync(profilePath);
    fs.unlinkSync(postsPath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to analyze ICP' });
  }
});

// GET tags
app.get('/api/tags', (req, res) => {
  try {
    if (!fs.existsSync(tagsPath)) {
      return res.json({ discipline: '', market: '', customerProfile: '', topicPillars: '' });
    }
    const tags = JSON.parse(fs.readFileSync(tagsPath, 'utf8'));
    res.json(tags);
  } catch (err) {
    console.error('Failed to read tags:', err);
    res.status(500).json({ error: 'Failed to read tags' });
  }
});

// POST save tags
app.post('/api/save-tags', express.json(), (req, res) => {
  try {
    const { discipline = '', market = '', customerProfile = '', topicPillars = '' } = req.body;
    const tags = { discipline, market, customerProfile, topicPillars };
    fs.writeFileSync(tagsPath, JSON.stringify(tags, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to save tags:', err);
    res.status(500).json({ error: 'Failed to save tags' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
}); 