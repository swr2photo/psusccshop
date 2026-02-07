// src/app/api/chatbot/route.ts
// AI-powered chatbot API with real-time database context + order lookup
import { NextRequest, NextResponse } from 'next/server';
import { processChat, buildDetailedShopContext, getShopData, ChatMessage, getCurrentModelName } from '@/lib/ai-chatbot';
import { QUICK_QUESTIONS, SHIRT_FAQ } from '@/lib/shirt-faq';
import { checkCombinedRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/chatbot
 * Body: { message: string, conversationHistory?: ChatMessage[] }
 * Returns: { answer: string, source: string, suggestions?: string[], relatedQuestions?: string[], confidence?: number }
 */
export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = checkCombinedRateLimit(req, { 
    maxRequests: 30, // More generous for chat
    windowSeconds: 60, 
    prefix: 'chatbot' 
  });
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ 
      answer: 'คุณส่งคำถามเร็วเกินไป กรุณารอสักครู่แล้วลองใหม่ค่ะ',
      source: 'rate-limit',
      suggestions: QUICK_QUESTIONS,
    }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { message, conversationHistory, image } = body;
    
    // Get user session (optional — chatbot works for anonymous users too)
    let userEmail: string | undefined;
    let userName: string | undefined;
    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.email) {
        userEmail = session.user.email;
        userName = session.user.name || undefined;
      }
    } catch {
      // Session fetch failed — continue without user context
    }
    
    // Log if image is received
    if (image) {
      console.log(`[Chatbot API] Received image: ${typeof image}, length: ${image?.length || 0}`);
    }
    
    // Allow empty message if image is provided
    if ((!message || typeof message !== 'string') && !image) {
      return NextResponse.json({ 
        answer: 'กรุณาพิมพ์คำถามเกี่ยวกับสินค้าหรือบริการของร้านค่ะ', 
        source: 'validation',
        suggestions: QUICK_QUESTIONS,
      }, { status: 400 });
    }

    // Limit message length - use default message if only image is sent
    const trimmedMessage = (message || 'ช่วยดูรูปนี้ให้หน่อยค่ะ').trim().slice(0, 1000);
    
    if (trimmedMessage.length < 2) {
      return NextResponse.json({ 
        answer: 'กรุณาพิมพ์คำถามให้ชัดเจนกว่านี้ค่ะ', 
        source: 'validation',
        suggestions: QUICK_QUESTIONS,
      }, { status: 400 });
    }

    // Parse conversation history if provided
    let history: ChatMessage[] | undefined;
    if (Array.isArray(conversationHistory)) {
      history = conversationHistory.slice(-10).map(msg => ({
        role: msg.role || (msg.sender === 'user' ? 'user' : 'assistant'),
        content: msg.content || msg.text || '',
      }));
    }

    // Process with AI (include image + user context)
    const result = await processChat(trimmedMessage, history, image, userEmail, userName);
    
    return NextResponse.json({
      answer: result.answer,
      source: result.source,
      matched: result.source !== 'fallback',
      suggestions: result.suggestions,
      relatedQuestions: result.relatedQuestions,
      productInfo: result.productInfo,
      confidence: result.confidence,
      productImages: result.productImages, // รูปภาพสินค้าที่เกี่ยวข้อง
      modelUsed: result.source === 'ai' ? getCurrentModelName() : undefined, // แสดงชื่อโมเดลที่ใช้
    });

  } catch (error) {
    console.error('Chatbot API error:', error);
    return NextResponse.json({ 
      answer: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งค่ะ', 
      source: 'error',
      suggestions: QUICK_QUESTIONS,
    }, { status: 500 });
  }
}

/**
 * GET /api/chatbot
 * Returns: Quick questions, FAQ categories, shop status, and shop info
 */
export async function GET(req: NextRequest) {
  try {
    const categories = [...new Set(SHIRT_FAQ.map(f => f.category))];
    
    // Get current shop data
    const shopData = await getShopData();
    
    return NextResponse.json({
      quickQuestions: QUICK_QUESTIONS,
      categories,
      totalFAQs: SHIRT_FAQ.length,
      shopStatus: shopData.isOpen ? 'open' : 'closed',
      aiEnabled: !!process.env.GEMINI_API_KEY,
      shopInfo: {
        totalProducts: shopData.stats?.totalProducts || 0,
        availableProducts: shopData.stats?.availableProducts || 0,
        priceRange: shopData.stats?.priceRange || { min: 0, max: 0 },
      },
    });
  } catch (error) {
    console.error('Chatbot GET error:', error);
    return NextResponse.json({
      quickQuestions: QUICK_QUESTIONS,
      categories: [],
      totalFAQs: SHIRT_FAQ.length,
      shopStatus: 'unknown',
      aiEnabled: false,
      shopInfo: null,
    });
  }
}

/**
 * OPTIONS - CORS support
 */
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
