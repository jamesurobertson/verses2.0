import { z } from "npm:zod@3.22.4";

// ESV API Response Types
const ESVPassageResponseSchema = z.object({
  query: z.string(),
  canonical: z.string(),
  parsed: z.array(z.array(z.number())),  // Fixed: parsed contains numbers, not strings
  passage_meta: z.array(z.object({
    canonical: z.string(),
    chapter_start: z.array(z.number()),
    chapter_end: z.array(z.number()),
    prev_verse: z.number(),
    next_verse: z.number(),
    prev_chapter: z.array(z.number()),
    next_chapter: z.array(z.number())
  })),
  passages: z.array(z.string())
});

// Sanitization utility
function sanitizeBibleReference(reference: string): string {
  return reference.replace(/\s+/g, ' ').trim();
}

// ESV API Client
class ESVApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = Deno.env.get('ESV_API_BASE_URL') ?? 'https://api.esv.org/v3';
    this.apiKey = Deno.env.get('ESV_API_KEY') ?? '';

    if (!this.apiKey) {
      throw new Error('ESV API Key is not configured');
    }
  }

  async getPassage(reference: string): Promise<z.infer<typeof ESVPassageResponseSchema>> {
    // Input validation
    if (!reference || reference.trim() === '') {
      throw new Error('Please enter a valid Bible reference (e.g., "John 3:16")');
    }

    if (reference.length > 200) {
      throw new Error('Bible reference is too long');
    }

    const sanitizedReference = sanitizeBibleReference(reference);

    try {
      const url = this.buildApiUrl(sanitizedReference);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ESV API Error: ${response.status} - ${errorText}`);

        switch (response.status) {
          case 400:
            throw new Error('Invalid Bible reference. Please check the spelling and try again.');
          case 401:
            throw new Error('Unable to connect to Bible service. API key may be invalid.');
          case 429:
            throw new Error('Too many requests. Please wait a moment and try again.');
          default:
            throw new Error(`Unable to fetch verse. Server responded with status ${response.status}`);
        }
      }

      const data = await response.json();
      
      // Validate response using Zod schema
      return ESVPassageResponseSchema.parse(data);

    } catch (error) {
      console.error('ESV API Request Error:', error);
      
      if (error instanceof z.ZodError) {
        throw new Error('Received invalid response from Bible service. Please try again.');
      }
      
      throw error instanceof Error 
        ? error 
        : new Error('Unexpected error occurred while fetching verse');
    }
  }

  private buildApiUrl(reference: string): string {
    const params = new URLSearchParams({
      q: reference,
      'include-headings': 'false',
      'include-footnotes': 'false',
      'include-verse-numbers': 'false',
      'include-short-copyright': 'false',
      'include-passage-references': 'false'
    });

    return `${this.baseUrl}/passage/text/?${params.toString()}`;
  }
}

// CORS Handling
function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }
  return null;
}

// Edge Function Handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Ensure only POST requests are handled
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { 
      status: 405,
      headers: { 
        'Access-Control-Allow-Origin': '*' 
      } 
    });
  }

  // SECURITY: Verify user authentication to prevent ESV API abuse
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ 
      error: 'Authorization header required' 
    }), { 
      status: 401,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // Verify the user token (simple JWT validation)
  const token = authHeader.replace('Bearer ', '');
  
  // For ESV API, we don't need full user context, just token validation
  // We'll do a lightweight check by trying to decode the JWT
  try {
    // Basic JWT structure validation (header.payload.signature)
    const jwtParts = token.split('.');
    if (jwtParts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    
    // Decode payload to check if it's a valid structure
    const payload = JSON.parse(atob(jwtParts[1]));
    if (!payload.sub || !payload.exp) {
      throw new Error('Invalid JWT payload');
    }
    
    // Check if token is expired
    if (payload.exp * 1000 < Date.now()) {
      throw new Error('Token expired');
    }
  } catch (_error) {
    return new Response(JSON.stringify({ 
      error: 'Invalid or expired token' 
    }), { 
      status: 401,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    // Parse request body
    const { reference } = await req.json();

    // Validate input
    if (!reference) {
      return new Response(JSON.stringify({ 
        error: 'Bible reference is required' 
      }), { 
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Initialize ESV API Client
    const esvApi = new ESVApiClient();

    // Fetch passage
    const passage = await esvApi.getPassage(reference);

    // Return successful response
    return new Response(JSON.stringify(passage), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Edge Function Error:', error);

    // Handle errors
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});