import { NextResponse } from 'next/server';

export async function GET() {
  const localhostUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL_LOCAL || 'http://localhost:8000';
  const backendUrl = localhostUrl.replace(/\/$/, '');

  return NextResponse.json({
    backendUrl,
    useLocalhost: true,
    productionUrl: backendUrl,
    localhostUrl: backendUrl,
  });
}

