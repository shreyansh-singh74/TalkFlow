import { NextResponse } from 'next/server';

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL_PROD || process.env.BACKEND_URL;
  const useLocalhost = process.env.NEXT_PUBLIC_USE_LOCALHOST === 'true';
  const localhostUrl = process.env.NEXT_PUBLIC_BACKEND_URL_LOCAL || 'http://localhost:8000';
  
  if (!useLocalhost && !backendUrl) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_BACKEND_URL_PROD is not set in environment variables' },
      { status: 500 }
    );
  }
  
  return NextResponse.json({
    backendUrl: useLocalhost ? localhostUrl : backendUrl,
    useLocalhost,
    productionUrl: backendUrl,
    localhostUrl,
  });
}

